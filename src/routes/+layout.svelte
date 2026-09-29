<script lang="ts">
  import "../app.css";
  import favicon from "$lib/assets/favicon.svg";
  import { page } from "$app/state";
  import { DropdownMenu, Tooltip } from "bits-ui";
  import Toaster from "$lib/components/Toaster.svelte";

  let { children } = $props();

  const links = [
    { href: "/", label: "สุ่มเลย", emoji: "🎲" },
    { href: "/vote", label: "โหวตกับเพื่อน", emoji: "🗳️" },
  ];

  const isActive = (href: string) =>
    href === "/" ? page.url.pathname === "/" : page.url.pathname.startsWith(href);
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link
    rel="preconnect"
    href="https://fonts.gstatic.com"
    crossorigin="anonymous"
  />
  <link
    href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;600;800&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<Tooltip.Provider delayDuration={300} skipDelayDuration={300}>
  <header class="mx-auto flex max-w-md items-center justify-between px-5 pt-6">
    <a href="/" class="text-xl font-extrabold tracking-tight">
      แล้วแต่<span class="text-brand">.</span>
    </a>

    <!-- เมนูเปลี่ยนหน้า -->
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label="เมนู"
        class="flex size-11 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-800 transition hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 data-[state=open]:bg-stone-900 data-[state=open]:text-white"
      >
        <svg
          viewBox="0 0 24 24"
          class="size-5"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          class="z-50 w-60 rounded-2xl border border-stone-200 bg-white p-1.5 shadow-lg outline-none data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in"
        >
          {#each links as link (link.href)}
            <DropdownMenu.Item>
              {#snippet child({ props })}
                <a
                  {...props}
                  href={link.href}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  class="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-stone-700 outline-none data-[highlighted]:bg-stone-100 data-[highlighted]:text-stone-900
                    {isActive(link.href) ? 'bg-stone-100 font-bold text-stone-900' : ''}"
                >
                  <span aria-hidden="true">{link.emoji}</span>
                  {link.label}
                  {#if isActive(link.href)}
                    <span class="ml-auto size-1.5 rounded-full bg-brand"></span>
                  {/if}
                </a>
              {/snippet}
            </DropdownMenu.Item>
          {/each}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  </header>

  {@render children()}
</Tooltip.Provider>

<Toaster />
