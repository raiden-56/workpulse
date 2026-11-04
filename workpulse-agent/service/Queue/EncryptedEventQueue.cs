using System.Buffers.Binary;
using System.Runtime.Versioning;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using WorkPulse.Service.Storage;
using WorkPulse.Shared.Ipc;

namespace WorkPulse.Service.Queue;

/// <summary>
/// Append-only, crash-safe, encrypted local event queue.
///
/// Files: %ProgramData%\WorkPulse\queue\events-YYYYMMDD.wpq (UTC day). Each record is
/// [4-byte big-endian length][12-byte nonce][AES-256-GCM ciphertext][16-byte tag]; the
/// plaintext is the JSON of one <see cref="ActivityEvent"/> with its assigned sequence.
/// The data key is protected with DPAPI (machine scope) by <see cref="SecretStore"/>.
/// The sequence counter is persisted before the record is written so numbers are never reused.
/// Nothing is ever discarded silently: synchronised events are removed, rejected events go to
/// dead-letter.wpq, and files that still hold pending events survive retention.
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class EncryptedEventQueue
{
    private const int NonceSize = 12;
    private const int TagSize = 16;
    private const int MaxRecordBytes = 1024 * 1024;

    public sealed record QueuedEvent(string File, ActivityEvent Event, int RecordBytes);

    private readonly AgentPaths _paths;
    private readonly ILogger<EncryptedEventQueue> _logger;
    private readonly byte[] _key;
    private readonly object _lock = new();
    private long _sequence;
    private long _depth;
    private readonly List<DeadLetterEntry> _deadLetters = new();

    public EncryptedEventQueue(AgentPaths paths, SecretStore secrets, ILogger<EncryptedEventQueue> logger)
    {
        _paths = paths;
        _logger = logger;
        _key = secrets.GetOrCreateQueueKey();
        Directory.CreateDirectory(_paths.Queue);
        _sequence = LoadSequence();
        _depth = RepairAndCount();
        LoadDeadLetterIndex();
        _logger.LogInformation("Event queue ready: {Depth} pending events, sequence {Sequence}", _depth, _sequence);
    }

    public long Depth { get { lock (_lock) { return _depth; } } }

    public long Sequence { get { lock (_lock) { return _sequence; } } }

    public int DeadLetterCount { get { lock (_lock) { return _deadLetters.Count; } } }

    /// <summary>Assigns the next sequence number, persists it, then appends the encrypted record (fsync'd).</summary>
    public long Enqueue(ActivityEvent evt)
    {
        lock (_lock)
        {
            _sequence++;
            evt.Sequence = _sequence;
            PersistSequence(_sequence);
            var file = Path.Combine(_paths.Queue, $"events-{DateTime.UtcNow:yyyyMMdd}.wpq");
            AppendRecord(file, Encrypt(Serialize(evt)));
            _depth++;
            return _sequence;
        }
    }

    /// <summary>Oldest pending events first, bounded by count and encoded size.</summary>
    public List<QueuedEvent> Peek(int maxCount, int maxBytes)
    {
        lock (_lock)
        {
            var result = new List<QueuedEvent>();
            long bytes = 0;
            foreach (var file in QueueFiles())
            {
                foreach (var (evt, size) in ReadRecords(file))
                {
                    if (result.Count >= maxCount || bytes + size > maxBytes)
                    {
                        return result;
                    }
                    result.Add(new QueuedEvent(file, evt, size));
                    bytes += size;
                }
            }
            return result;
        }
    }

    /// <summary>Removes the given events (by id) by rewriting the affected files atomically.</summary>
    public int Remove(IReadOnlyCollection<string> eventIds)
    {
        if (eventIds.Count == 0)
        {
            return 0;
        }
        var ids = new HashSet<string>(eventIds, StringComparer.OrdinalIgnoreCase);
        lock (_lock)
        {
            var removed = 0;
            foreach (var file in QueueFiles())
            {
                var keep = new List<byte[]>();
                var touched = false;
                foreach (var (evt, _, raw) in ReadRawRecords(file))
                {
                    if (ids.Contains(evt.EventId))
                    {
                        touched = true;
                        removed++;
                    }
                    else
                    {
                        keep.Add(raw);
                    }
                }
                if (!touched)
                {
                    continue;
                }
                if (keep.Count == 0)
                {
                    File.Delete(file);
                    continue;
                }
                var tmp = file + ".tmp";
                using (var fs = new FileStream(tmp, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    foreach (var raw in keep)
                    {
                        WriteFramed(fs, raw);
                    }
                    fs.Flush(flushToDisk: true);
                }
                File.Move(tmp, file, overwrite: true);
            }
            _depth = Math.Max(0, _depth - removed);
            return removed;
        }
    }

    /// <summary>Parks an event the backend refused. Content stays encrypted; the index holds only ids and reasons.</summary>
    public void DeadLetter(ActivityEvent evt, string reason)
    {
        lock (_lock)
        {
            AppendRecord(_paths.DeadLetterFile, Encrypt(Serialize(evt)));
            _deadLetters.Insert(0, new DeadLetterEntry { EventId = evt.EventId, Type = evt.Type, Reason = reason, At = DateTimeOffset.UtcNow });
            if (_deadLetters.Count > 200)
            {
                _deadLetters.RemoveRange(200, _deadLetters.Count - 200);
            }
            File.WriteAllText(_paths.DeadLetterIndexFile, JsonSerializer.Serialize(_deadLetters, IpcProtocol.Json));
        }
        _logger.LogWarning("Event {EventId} ({Type}) dead-lettered: {Reason}", evt.EventId, evt.Type, reason);
    }

    public List<DeadLetterEntry> DeadLetters()
    {
        lock (_lock)
        {
            return _deadLetters.ToList();
        }
    }

    public QueueStats Stats()
    {
        lock (_lock)
        {
            var files = QueueFiles().ToList();
            DateTimeOffset? oldest = null;
            foreach (var file in files)
            {
                var first = ReadRecords(file).Select(r => r.Item1).FirstOrDefault();
                if (first != null && (oldest == null || first.OccurredAt < oldest))
                {
                    oldest = first.OccurredAt;
                }
            }
            return new QueueStats
            {
                Depth = _depth,
                Files = files.Count,
                Bytes = files.Sum(f => new FileInfo(f).Length),
                OldestEventAt = oldest,
                Sequence = _sequence,
            };
        }
    }

    /// <summary>Deletes empty/absent day files older than the retention window. Files with pending events are kept and reported.</summary>
    public void ApplyRetention(int retentionDays)
    {
        lock (_lock)
        {
            var cutoff = DateTime.UtcNow.Date.AddDays(-Math.Max(1, retentionDays));
            foreach (var file in QueueFiles())
            {
                var name = Path.GetFileNameWithoutExtension(file);
                if (name.Length < 15 || !DateTime.TryParseExact(name[7..], "yyyyMMdd", null, System.Globalization.DateTimeStyles.AssumeUniversal, out var day))
                {
                    continue;
                }
                if (day >= cutoff)
                {
                    continue;
                }
                var pending = ReadRecords(file).Count();
                if (pending == 0)
                {
                    File.Delete(file);
                }
                else
                {
                    _logger.LogWarning("Queue file {File} is older than {Days} days but still holds {Pending} unsynchronised events; keeping it", file, retentionDays, pending);
                }
            }
        }
    }

    // ----- internals -----

    private IEnumerable<string> QueueFiles() =>
        Directory.EnumerateFiles(_paths.Queue, "events-*.wpq").OrderBy(f => f, StringComparer.OrdinalIgnoreCase);

    private IEnumerable<(ActivityEvent, int)> ReadRecords(string file) =>
        ReadRawRecords(file).Select(r => (r.Item1, r.Item2));

    private IEnumerable<(ActivityEvent, int, byte[])> ReadRawRecords(string file)
    {
        if (!File.Exists(file))
        {
            yield break;
        }
        using var fs = new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        var lenBuf = new byte[4];
        while (fs.Position < fs.Length)
        {
            if (fs.Read(lenBuf, 0, 4) != 4)
            {
                yield break; // truncated tail (repaired at next startup)
            }
            var len = BinaryPrimitives.ReadInt32BigEndian(lenBuf);
            if (len <= NonceSize + TagSize || len > MaxRecordBytes || fs.Position + len > fs.Length)
            {
                yield break;
            }
            var raw = new byte[len];
            var read = 0;
            while (read < len)
            {
                var n = fs.Read(raw, read, len - read);
                if (n <= 0) { yield break; }
                read += n;
            }
            ActivityEvent? evt = null;
            try
            {
                evt = JsonSerializer.Deserialize<ActivityEvent>(Decrypt(raw), IpcProtocol.Json);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Undecryptable record in {File}; skipping", file);
            }
            if (evt != null)
            {
                yield return (evt, len + 4, raw);
            }
        }
    }

    private long RepairAndCount()
    {
        long count = 0;
        foreach (var file in QueueFiles().Concat(File.Exists(_paths.DeadLetterFile) ? new[] { _paths.DeadLetterFile } : Array.Empty<string>()))
        {
            var good = ValidLength(file);
            var length = new FileInfo(file).Length;
            if (good < length)
            {
                _logger.LogWarning("Truncating partial record at the end of {File} ({Bad} bytes)", file, length - good);
                using var fs = new FileStream(file, FileMode.Open, FileAccess.Write, FileShare.None);
                fs.SetLength(good);
            }
            if (!file.EndsWith("dead-letter.wpq", StringComparison.OrdinalIgnoreCase))
            {
                count += ReadRecords(file).Count();
            }
        }
        return count;
    }

    private static long ValidLength(string file)
    {
        using var fs = new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        var lenBuf = new byte[4];
        long good = 0;
        while (fs.Position < fs.Length)
        {
            if (fs.Read(lenBuf, 0, 4) != 4) { break; }
            var len = BinaryPrimitives.ReadInt32BigEndian(lenBuf);
            if (len <= 0 || len > MaxRecordBytes || fs.Position + len > fs.Length) { break; }
            fs.Seek(len, SeekOrigin.Current);
            good = fs.Position;
        }
        return good;
    }

    private void AppendRecord(string file, byte[] raw)
    {
        using var fs = new FileStream(file, FileMode.Append, FileAccess.Write, FileShare.Read);
        WriteFramed(fs, raw);
        fs.Flush(flushToDisk: true);
    }

    private static void WriteFramed(Stream stream, byte[] raw)
    {
        Span<byte> len = stackalloc byte[4];
        BinaryPrimitives.WriteInt32BigEndian(len, raw.Length);
        stream.Write(len);
        stream.Write(raw);
    }

    private byte[] Encrypt(byte[] plaintext)
    {
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        var cipher = new byte[plaintext.Length];
        var tag = new byte[TagSize];
        using var aes = new AesGcm(_key, TagSize);
        aes.Encrypt(nonce, plaintext, cipher, tag);
        var raw = new byte[NonceSize + cipher.Length + TagSize];
        nonce.CopyTo(raw, 0);
        cipher.CopyTo(raw, NonceSize);
        tag.CopyTo(raw, NonceSize + cipher.Length);
        return raw;
    }

    private byte[] Decrypt(byte[] raw)
    {
        var nonce = raw.AsSpan(0, NonceSize);
        var tag = raw.AsSpan(raw.Length - TagSize, TagSize);
        var cipher = raw.AsSpan(NonceSize, raw.Length - NonceSize - TagSize);
        var plain = new byte[cipher.Length];
        using var aes = new AesGcm(_key, TagSize);
        aes.Decrypt(nonce, cipher, tag, plain);
        return plain;
    }

    private static byte[] Serialize(ActivityEvent evt) => Encoding.UTF8.GetBytes(JsonSerializer.Serialize(evt, IpcProtocol.Json));

    private long LoadSequence()
    {
        try
        {
            return File.Exists(_paths.SequenceFile) && long.TryParse(File.ReadAllText(_paths.SequenceFile).Trim(), out var s) ? s : 0;
        }
        catch
        {
            return 0;
        }
    }

    private void PersistSequence(long value)
    {
        using var fs = new FileStream(_paths.SequenceFile, FileMode.Create, FileAccess.Write, FileShare.None);
        var bytes = Encoding.ASCII.GetBytes(value.ToString());
        fs.Write(bytes, 0, bytes.Length);
        fs.Flush(flushToDisk: true);
    }

    private void LoadDeadLetterIndex()
    {
        try
        {
            if (File.Exists(_paths.DeadLetterIndexFile))
            {
                var list = JsonSerializer.Deserialize<List<DeadLetterEntry>>(File.ReadAllText(_paths.DeadLetterIndexFile), IpcProtocol.Json);
                if (list != null) { _deadLetters.AddRange(list); }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not read the dead-letter index");
        }
    }
}
