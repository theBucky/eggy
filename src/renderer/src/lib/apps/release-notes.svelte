<script lang="ts" module>
  import DOMPurify from 'dompurify'
  import { marked } from 'marked'
  import './release-notes.css'

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') node.setAttribute('target', '_blank')
  })

  function render(format: 'html' | 'markdown', text: string): string {
    return DOMPurify.sanitize(format === 'markdown' ? marked.parse(text, { async: false }) : text, {
      ALLOWED_TAGS: [
        'p',
        'br',
        'hr',
        'ul',
        'ol',
        'li',
        'blockquote',
        'pre',
        'code',
        'a',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'strong',
        'b',
        'em',
        'i'
      ],
      ALLOWED_ATTR: ['href']
    })
  }
</script>

<script lang="ts">
  import IconExternalLink from '@tabler/icons-svelte/icons/external-link'
  import { Button } from '$lib/components/ui/button'
  import type { Notes } from '$shared/api'

  let { notes }: { notes: Notes } = $props()
</script>

{#if notes.format === 'link'}
  <div>
    <Button variant="outline" size="sm" href={notes.url} target="_blank">
      Open release notes
      <IconExternalLink data-icon="inline-end" />
    </Button>
  </div>
{:else if notes.format === 'plain-text'}
  <p class="release-notes whitespace-pre-wrap">{notes.text}</p>
{:else}
  <div class="release-notes">
    {@html render(notes.format, notes.text)}
  </div>
{/if}
