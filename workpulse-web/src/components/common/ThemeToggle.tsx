import { IconButton, Tooltip } from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';

export function ThemeToggle() {
  const { mode, setMode } = useColorScheme();
  const dark = mode === 'dark';
  return (
    <Tooltip title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
      <IconButton onClick={() => setMode(dark ? 'light' : 'dark')} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} size="small">
        {dark ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
      </IconButton>
    </Tooltip>
  );
}
