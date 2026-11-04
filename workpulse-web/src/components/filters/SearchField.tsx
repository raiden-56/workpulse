import { IconButton, InputAdornment, TextField } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { useEffect, useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  delayMs?: number;
  autoFocus?: boolean;
  fullWidth?: boolean;
}

/** Debounced search input; `onChange` fires after the user pauses typing. */
export function SearchField({ value, onChange, placeholder = 'Search…', label, delayMs = 300, autoFocus, fullWidth }: SearchFieldProps) {
  const [draft, setDraft] = useState(value);
  const debounced = useDebounce(draft, delayMs);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (debounced !== value) {
      onChange(debounced);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <TextField
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      placeholder={placeholder}
      label={label}
      autoFocus={autoFocus}
      fullWidth={fullWidth}
      inputProps={{ 'aria-label': label ?? placeholder }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
          endAdornment: draft ? (
            <InputAdornment position="end">
              <IconButton size="small" aria-label="Clear search" onClick={() => setDraft('')}>
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        },
      }}
      sx={{ minWidth: { sm: 240 } }}
    />
  );
}
