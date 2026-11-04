import { IconButton, InputAdornment, TextField, Tooltip } from '@mui/material';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import CheckIcon from '@mui/icons-material/Check';
import { useState } from 'react';

interface CopyFieldProps {
  label: string;
  value: string;
  helperText?: string;
}

export function CopyField({ label, value, helperText }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable: user can still select the text
    }
  };
  return (
    <TextField
      label={label}
      value={value}
      fullWidth
      helperText={helperText}
      slotProps={{
        input: {
          readOnly: true,
          className: 'wp-mono',
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip title={copied ? 'Copied' : 'Copy'}>
                <IconButton onClick={copy} size="small" aria-label={`Copy ${label}`}>
                  {copied ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyOutlinedIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
