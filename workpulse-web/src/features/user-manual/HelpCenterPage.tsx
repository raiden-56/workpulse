import { Alert, Box, Grid, List, ListItemButton, ListItemText, ListSubheader, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { SearchField } from '@/components/filters/SearchField';
import { MANUAL, type ManualBlock, type ManualSection } from './manualContent';

function matches(section: ManualSection, query: string): boolean {
  const q = query.toLowerCase();
  if (!q) return true;
  if (section.title.toLowerCase().includes(q) || section.summary.toLowerCase().includes(q)) return true;
  return section.blocks.some((b) => ('text' in b ? b.text.toLowerCase().includes(q) : b.items.some((i) => i.toLowerCase().includes(q))));
}

export function HelpCenterPage() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const sections = useMemo(() => MANUAL.filter((s) => matches(s, query)), [query]);
  const activeId = params.get('topic') ?? sections[0]?.id ?? MANUAL[0].id;
  const active = MANUAL.find((s) => s.id === activeId) ?? MANUAL[0];
  const categories = Array.from(new Set(sections.map((s) => s.category)));

  return (
    <>
      <PageHeader title="Help centre" subtitle="The built-in WorkPulse manual: concepts, role guides, the desktop agent and privacy." actions={<SearchField value={query} onChange={setQuery} placeholder="Search the manual…" />} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4, lg: 3 }}>
          <Panel padded={false}>
            <List dense component="nav" aria-label="Manual topics" sx={{ maxHeight: { md: 'calc(100vh - 220px)' }, overflowY: 'auto' }}>
              {sections.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                  No topics match “{query}”.
                </Typography>
              )}
              {categories.map((cat) => (
                <Box key={cat}>
                  <ListSubheader disableSticky sx={{ bgcolor: 'transparent', lineHeight: '32px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {cat}
                  </ListSubheader>
                  {sections
                    .filter((s) => s.category === cat)
                    .map((s) => (
                      <ListItemButton key={s.id} selected={s.id === active.id} onClick={() => setParams({ topic: s.id }, { replace: true })} sx={{ borderRadius: 1, mx: 1 }}>
                        <ListItemText primary={s.title} primaryTypographyProps={{ fontSize: 13.5, fontWeight: s.id === active.id ? 600 : 500 }} />
                      </ListItemButton>
                    ))}
                </Box>
              ))}
            </List>
          </Panel>
        </Grid>
        <Grid size={{ xs: 12, md: 8, lg: 9 }}>
          <Panel>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {active.category}
            </Typography>
            <Typography variant="h3" component="h2" sx={{ mb: 1 }}>
              {active.title}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              {active.summary}
            </Typography>
            {active.blocks.map((b, i) => (
              <Block key={i} block={b} />
            ))}
          </Panel>
        </Grid>
      </Grid>
    </>
  );
}

function Block({ block }: { block: ManualBlock }) {
  switch (block.type) {
    case 'h':
      return (
        <Typography variant="h5" sx={{ mt: 2, mb: 0.5 }}>
          {block.text}
        </Typography>
      );
    case 'p':
      return (
        <Typography variant="body1" sx={{ mb: 1.5, maxWidth: 760 }}>
          {block.text}
        </Typography>
      );
    case 'ul':
      return (
        <Box component="ul" sx={{ pl: 2.5, mb: 1.5, maxWidth: 760 }}>
          {block.items.map((i) => (
            <Typography key={i} component="li" variant="body1" sx={{ mb: 0.5 }}>
              {i}
            </Typography>
          ))}
        </Box>
      );
    case 'steps':
      return (
        <Box component="ol" sx={{ pl: 2.5, mb: 1.5, maxWidth: 760 }}>
          {block.items.map((i) => (
            <Typography key={i} component="li" variant="body1" sx={{ mb: 0.75 }}>
              {i}
            </Typography>
          ))}
        </Box>
      );
    case 'note':
      return (
        <Alert severity="info" variant="outlined" sx={{ mb: 1.5, maxWidth: 760 }}>
          {block.text}
        </Alert>
      );
  }
}
