<script lang="ts">
  import "../app.css";
  import favicon from "$lib/assets/favicon.svg";
  import { page } from "$app/state";
  import { DropdownMenu, Tooltip } from "bits-ui";
  import { onMount } from "svelte";
  import Toaster from "$lib/components/Toaster.svelte";
  import { feedback } from "$lib/feedback.svelte";
  import { theme } from "$lib/theme.svelte";

  let { children } = $props();

  onMount(() => {
    feedback.init();
    theme.init();
  });

  const links = [
    { href: "/", label: "สุ่มเลย", emoji: "🎲" },
    { href: "/vote", label: "โหวตกับเพื่อน", emoji: "🗳️" },
    { href: "/swipe", label: "ปัดกับเพื่อน", emoji: "👆" },
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

    <div class="flex items-center gap-2">
    <!-- เปิด/ปิดเสียงและการสั่น -->
    <button
      onclick={() => feedback.setEnabled(!feedback.enabled)}
      aria-pressed={feedback.enabled}
      aria-label={feedback.enabled ? "ปิดเสียงและการสั่น" : "เปิดเสียงและการสั่น"}
      class="flex size-11 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-800 transition hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
    >
      <svg
        viewBox="0 0 24 24"
        class="size-5"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M11 5 6 9H3v6h3l5 4V5Z" />
        {#if feedback.enabled}
          <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
        {:else}
          <path d="m16 9 5 6m0-6-5 6" />
        {/if}
      </svg>
    </button>

    <!-- สลับธีมสว่าง / มืด -->
    <button
      onclick={() => theme.toggle()}
      aria-label={theme.current === "dark" ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"}
      class="flex size-11 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-800 transition hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
    >
      <svg
        viewBox="0 0 24 24"
        class="size-5"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        {#if theme.current === "dark"}
          <!-- ดวงอาทิตย์ (กดเพื่อกลับไปสว่าง) -->
          <circle cx="12" cy="12" r="4" />
          <path
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          />
        {:else}
          <!-- พระจันทร์ (กดเพื่อไปมืด) -->
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        {/if}
      </svg>
    </button>

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
    </div>
  </header>

  {@render children()}
</Tooltip.Provider>

<Toaster />
