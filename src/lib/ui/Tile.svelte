<script lang="ts">
  let {
    label,
    value,
    unit,
    sub,
    tone = 'plain',
    open = false,
    panelId,
    ontoggle,
    mono = false,
  }: {
    label: string;
    value: string;
    unit?: string;
    sub: string;
    tone?: 'on' | 'watch' | 'off' | 'plain';
    open?: boolean;
    panelId: string;
    ontoggle: () => void;
    mono?: boolean;
  } = $props();
</script>

<div class={['tile', tone, open && 'open']}>
  <span class="label">{label}</span>
  <button type="button" class="why" aria-expanded={open} aria-controls={panelId} aria-label="Explain {label}" onclick={ontoggle}>?</button>
  <span class={['value', mono && 'mono stamp-value']}>{value}{#if unit}<small>{unit}</small>{/if}</span>
  <span class="sub">{sub}</span>
</div>
