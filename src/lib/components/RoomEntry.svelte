<script lang="ts">
  // หน้าสร้างห้อง / เข้าห้อง ใช้ร่วมกันทั้ง "โหวตกับเพื่อน" และ "ปัดกับเพื่อน"
  import { goto } from "$app/navigation";
  import { Label, ToggleGroup } from "bits-ui";
  import { supabase, ensureUser } from "$lib/supabase";
  import { categories } from "$lib/data/categories";
  import { makeCode, normalizeCode, type RoomMode } from "$lib/room";
  import { toast } from "$lib/toast.svelte";

  type Props = {
    mode: RoomMode;
    title: string;
    description: string;
  };
  let { mode, title, description }: Props = $props();

  let categoryId = $state(categories[0].id);
  let creating = $state(false);
  let joinCode = $state("");

  async function createRoom() {
    if (creating) return;
    creating = true;
    try {
      const user = await ensureUser();
      // ล้างห้องที่หมดอายุทุกครั้งที่มีคนสร้างห้อง (สำรองไว้เผื่อ pg_cron ไม่ได้เปิด)
      void supabase.rpc("cleanup_expired_rooms");
      for (let i = 0; i < 5; i++) {
        const code = makeCode();
        const { error } = await supabase
          .from("rooms")
          .insert({ code, mode, category: categoryId, host_id: user.id });
        if (!error) {
          await goto(`/room/${code}`);
          return;
        }
        if (error.code !== "23505") throw error; // 23505 = รหัสซ้ำ → สุ่มใหม่
      }
      throw new Error("สร้างรหัสห้องไม่สำเร็จ");
    } catch (e) {
      console.error(e);
      toast.show("สร้างห้องไม่สำเร็จ ลองอีกครั้งนะ");
    } finally {
      creating = false;
    }
  }

  function joinRoom() {
    const code = normalizeCode(joinCode);
    if (code.length < 5) {
      toast.show("รหัสห้องมี 5 ตัวอักษร");
      return;
    }
    goto(`/room/${code}`);
  }

  const btnPrimary =
    "inline-flex items-center justify-center rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";
</script>

<main class="mx-auto max-w-md px-5 pt-6 pb-10">
  <h1 class="text-2xl font-extrabold tracking-tight">{title}</h1>
  <p class="mt-1 text-sm text-stone-500">{description}</p>

  <!-- สร้างห้อง -->
  <section class="mt-6 rounded-2xl border border-stone-200 bg-white p-5">
    <h2 class="font-bold">สร้างห้องใหม่</h2>

    <Label.Root class="mt-4 block text-sm font-medium text-stone-700">
      หมวดหมู่
    </Label.Root>
    <ToggleGroup.Root
      type="single"
      bind:value={
        () => categoryId,
        (v) => {
          if (v) categoryId = v;
        }
      }
      aria-label="หมวดหมู่ของห้อง"
      class="mt-2 flex flex-wrap gap-1.5"
    >
      {#each categories as c (c.id)}
        <ToggleGroup.Item
          value={c.id}
          class="rounded-full border border-stone-300 bg-white px-3.5 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 data-[state=on]:border-stone-900 data-[state=on]:bg-stone-900 data-[state=on]:text-white"
        >
          <span aria-hidden="true">{c.emoji}</span>
          {c.name}
        </ToggleGroup.Item>
      {/each}
    </ToggleGroup.Root>

    <button
      onclick={createRoom}
      disabled={creating}
      class="{btnPrimary} mt-5 w-full py-3.5"
    >
      {creating ? "กำลังสร้างห้อง…" : "สร้างห้อง"}
    </button>
  </section>

  <!-- เข้าร่วมห้อง -->
  <section class="mt-4 rounded-2xl border border-stone-200 bg-white p-5">
    <h2 class="font-bold">มีรหัสห้องแล้ว?</h2>
    <form
      class="mt-3 flex gap-2"
      onsubmit={(e) => {
        e.preventDefault();
        joinRoom();
      }}
    >
      <input
        bind:value={joinCode}
        oninput={() => (joinCode = normalizeCode(joinCode))}
        maxlength="5"
        placeholder="รหัส 5 ตัว"
        autocapitalize="characters"
        autocomplete="off"
        aria-label="รหัสห้อง"
        class="min-w-0 flex-1 rounded-full border border-stone-200 bg-stone-50 px-4 py-2.5 text-center font-mono text-lg tracking-[0.3em] uppercase outline-none focus:border-stone-900 focus:bg-white"
      />
      <button type="submit" class={btnPrimary}>เข้าห้อง</button>
    </form>
  </section>
</main>
