<script lang="ts" module>
  import { renderToHtml } from '@pierre/words'
  import DOMPurify from 'dompurify'

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') node.setAttribute('target', '_blank')
  })

  const decoder = new TextDecoder()

  function render(format: 'html' | 'markdown', text: string): string {
    const html = format === 'markdown' ? decoder.decode(renderToHtml(text, { cjk: true })) : text

    return DOMPurify.sanitize(html, {
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
  <Button href={notes.url} target="_blank">
    Open release notes
    <IconExternalLink data-icon="inline-end" />
  </Button>
{:else if notes.format === 'plain-text'}
  <p class="typeset text-base whitespace-pre-wrap select-text">{notes.text}</p>
{:else}
  <div class="typeset text-base select-text">
    {@html render(notes.format, notes.text)}
  </div>
{/if}
