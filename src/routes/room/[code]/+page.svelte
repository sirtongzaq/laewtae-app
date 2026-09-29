<script lang="ts">
  import { onMount, onDestroy, tick, untrack } from "svelte";
  import { page } from "$app/state";
  import { Dialog } from "bits-ui";
  import type { RealtimeChannel } from "@supabase/supabase-js";
  import { supabase, ensureUser } from "$lib/supabase";
  import { categories } from "$lib/data/categories";
  import {
    randomInt,
    limitMessage,
    MAX_OPTIONS,
    MAX_MEMBERS,
    type Room,
    type Option,
    type Vote,
    type Swipe,
    type Member,
  } from "$lib/room";
  import { toast } from "$lib/toast.svelte";
  import { feedback } from "$lib/feedback.svelte";
  import { recents } from "$lib/recents.svelte";
  import { nearby } from "$lib/nearby.svelte";
  import Wheel from "$lib/components/Wheel.svelte";
  import SwipeDeck from "$lib/components/SwipeDeck.svelte";

  /** ข้อมูลที่ host broadcast ให้ทุกเครื่องหมุนวงล้อตัดสินให้เหมือนกัน */
  type TiebreakPayload = { items: string[]; index: number; jitter: number };

  const NAME_KEY = "laewtae:name";
  const code = (page.params.code ?? "").toUpperCase();

  // ---------- state ----------
  let loading = $state(true);
  let notFound = $state(false);
  let fatal = $state<string | null>(null);

  let me = $state<string | null>(null);
  let name = $state("");
  let nameInput = $state("");

  let room = $state<Room | null>(null);
  let options = $state<Option[]>([]);
  let votes = $state<Vote[]>([]);
  let swipes = $state<Swipe[]>([]);
  // การปัดที่เพิ่งกด (แสดงผลทันทีโดยไม่รอฐานข้อมูล): option_id → ถูกใจไหม
  let pendingSwipes = $state<Record<string, boolean>>({});
  let members = $state<Member[]>([]);

  let connected = $state(false);
  let roomFull = $state(false); // ห้องเต็มแล้ว (คนที่เข้าทีหลังเกิน MAX_MEMBERS)
  let hadConnected = false;
  let lastSync = 0;
  let ready = $state(false);
  let newItem = $state("");

  // วงล้อตัดสินตอนคะแนนเสมอ
  let tbWheel = $state<ReturnType<typeof Wheel> | undefined>();
  let tbItems = $state<string[] | null>(null);
  let tbSpinning = $state(false);
  let tbSeen = $state(false); // เครื่องนี้เริ่มหมุนวงล้อตัดสินในรอบนี้แล้ว (กันเสียง/นับถอยหลังซ้ำ)

  // นับถอยหลังอัตโนมัติ (ค่าที่เหลือ หรือ null เมื่อไม่ได้นับ)
  let lobbyCd = $state<number | null>(null);
  let tbCd = $state<number | null>(null);
  let voteCd = $state<number | null>(null);
  let destroyed = false;

  let channel: RealtimeChannel | null = null;
  const joinedAt = Date.now();

  // ---------- derived ----------
  const isHost = $derived(!!room && me === room.host_id);
  const category = $derived(
    categories.find((c) => c.id === room?.category) ?? categories[0],
  );

  const sortedMembers = $derived(
    [...members].sort((a, b) =>
      a.id === room?.host_id ? -1 : b.id === room?.host_id ? 1 : a.at - b.at,
    ),
  );
  // เจ้าของห้องนับเป็น "พร้อม" โดยอัตโนมัติ — รอเฉพาะเพื่อนที่เหลือ
  const guests = $derived(members.filter((m) => m.id !== room?.host_id));
  const notReady = $derived(guests.filter((m) => !m.ready));
  const canStart = $derived(isHost && options.length >= 2 && notReady.length === 0);

  const isSwipe = $derived(room?.mode === "swipe");
  const verb = $derived(isSwipe ? "ปัด" : "โหวต");

  // โหมดโหวต: 1 คะแนน = 1 โหวต / โหมดปัด: 1 คะแนน = 1 คนที่ปัดขวา (ถูกใจ)
  const tally = $derived(
    options.map((o) => {
      if (isSwipe) {
        const liked = swipes.filter((s) => s.option_id === o.id && s.liked);
        return { ...o, count: liked.length, voters: liked.map((s) => s.voter_name ?? "?") };
      }
      const vs = votes.filter((v) => v.option_id === o.id);
      return { ...o, count: vs.length, voters: vs.map((v) => v.voter_name ?? "?") };
    }),
  );
  const activity = $derived(isSwipe ? swipes.length : votes.length);
  const ranking = $derived([...tally].sort((a, b) => b.count - a.count));
  const maxCount = $derived(Math.max(0, ...tally.map((t) => t.count)));
  // โหมดปัดแล้วไม่มีใครถูกใจอะไรเลย → ให้ทุกตัวเลือกเสมอกัน แล้วหมุนวงล้อตัดสิน
  const tiedOptions = $derived(
    maxCount > 0
      ? tally.filter((t) => t.count === maxCount)
      : isSwipe && swipes.length > 0
        ? tally
        : [],
  );

  // โหมดปัด: การ์ดที่เรายังไม่ได้ปัด
  const swipedBy = (id: string) => swipes.filter((s) => s.voter_id === id).length;
  const mySwiped = $derived(
    new Set([
      ...swipes.filter((s) => s.voter_id === me).map((s) => s.option_id),
      ...Object.keys(pendingSwipes),
    ]),
  );
  const deck = $derived(options.filter((o) => !mySwiped.has(o.id)));
  const progressOf = (id: string) => Math.min(options.length, swipedBy(id));
  const tiedCount = $derived(tiedOptions.length);
  // ปิดโหวตแล้วแต่ยังไม่มีผู้ชนะ = คะแนนเสมอ รอหมุนวงล้อตัดสิน
  const inTiebreak = $derived(room?.status === "done" && !room.winner);
  const showWheel = $derived(inTiebreak || tbSpinning);
  const wheelItems = $derived(tbItems ?? tiedOptions.map((t) => t.title));

  // เงื่อนไขเริ่มนับถอยหลังอัตโนมัติ
  // - เริ่มโหวต: มีเพื่อนอย่างน้อย 1 คน + ทุกคนกดพร้อม + มีตัวเลือก ≥ 2 (เล่นคนเดียวใช้ปุ่มเอง)
  // - วงล้อตัดสิน: คะแนนเสมอและยังไม่เคยหมุน
  const autoStartOk = $derived(
    connected &&
      room?.status === "lobby" &&
      guests.length >= 1 &&
      notReady.length === 0 &&
      options.length >= 2,
  );
  const myVote = $derived(votes.find((v) => v.voter_id === me)?.option_id ?? null);
  // จำนวนคนที่ "เสร็จ" แล้ว: โหมดโหวต = โหวตแล้ว / โหมดปัด = ปัดครบทุกใบ
  const votedCount = $derived(
    isSwipe
      ? members.filter((m) => options.length > 0 && progressOf(m.id) >= options.length).length
      : members.filter((m) => votes.some((v) => v.voter_id === m.id)).length,
  );
  const allVoted = $derived(members.length > 0 && votedCount === members.length);
  // - ประกาศผล: ทุกคนที่อยู่ในห้องโหวตครบแล้ว
  const autoFinishOk = $derived(
    connected && room?.status === "voting" && activity > 0 && allVoted,
  );
  const autoTiebreakOk = $derived(
    connected && inTiebreak && !tbSeen && !tbSpinning && wheelItems.length >= 2,
  );
  // คำแนะนำ: ตัดของที่ถูกเพิ่มแล้ว และเอาของที่เพิ่งได้ภายใน N วันไปไว้ท้ายสุด
  const recentSet = $derived(recents.recentTitles());
  const suggestions = $derived.by(() => {
    const fresh = category.items.filter((t) => !options.some((o) => o.title === t));
    return [
      ...fresh.filter((t) => !recentSet.has(t)),
      ...fresh.filter((t) => recentSet.has(t)),
    ];
  });
  const mapsUrl = $derived(room?.winner ? nearby.url(room.winner) : "");

  // จำห้องนี้ไว้ในเครื่อง + บันทึกผลเมื่อจบ (ไม่ซ้ำตาม ref)
  $effect(() => {
    if (!room) return;
    const r = room;
    // รอให้โหลดตัวเลือกก่อน จะได้บันทึก "สุ่มจาก..." ครบ (ผลซ้ำถูกกันด้วย ref)
    const n = options.length;
    untrack(() => {
      recents.touchRoom({
        code,
        mode: r.mode,
        category: r.category,
        expiresAt: Date.parse(r.expires_at),
        winner: r.winner,
      });
      if (r.winner && n > 0) {
        recents.addResult({
          title: r.winner,
          category: r.category,
          source: r.mode,
          ref: `${code}:${r.winner}`,
          from: options.map((o) => o.title),
          code,
        });
      }
    });
  });

  // ---------- data ----------
  async function fetchOptions() {
    if (!room) return;
    const { data } = await supabase
      .from("options")
      .select("*")
      .eq("room_id", room.id)
      .order("created_at");
    options = (data ?? []) as Option[];
  }

  async function fetchVotes() {
    if (!room) return;
    const { data } = await supabase.from("votes").select("*").eq("room_id", room.id);
    votes = (data ?? []) as Vote[];
  }

  async function fetchSwipes() {
    if (!room) return;
    const { data } = await supabase.from("swipes").select("*").eq("room_id", room.id);
    swipes = (data ?? []) as Swipe[];
  }

  onMount(async () => {
    try {
      name = localStorage.getItem(NAME_KEY) ?? "";
    } catch {
      /* ไม่มี localStorage ก็ถามชื่อใหม่ */
    }

    try {
      const user = await ensureUser();
      me = user.id;

      // เข้าห้องด้วยรหัสผ่านฟังก์ชัน join_room เท่านั้น (ค้นตาราง rooms ตรง ๆ ไม่ได้แล้ว)
      // ฟังก์ชันจะเช็กรหัส / วันหมดอายุ / เพดาน 10 คน แล้วเพิ่มเราเป็นสมาชิกห้อง
      const { data, error } = await supabase.rpc("join_room", { p_code: code });
      if (error) {
        if (error.message.includes("LIMIT_MEMBERS")) {
          roomFull = true;
          return;
        }
        throw error;
      }
      const found = (data as Room[] | null)?.[0];
      if (!found) {
        notFound = true;
        recents.forgetRoom(code);
        return;
      }
      room = found;
      await Promise.all([
        fetchOptions(),
        room.mode === "swipe" ? fetchSwipes() : fetchVotes(),
      ]);
      connect(room);
    } catch (e) {
      console.error(e);
      fatal = "เชื่อมต่อไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้งนะ";
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    destroyed = true;
    if (channel) supabase.removeChannel(channel);
  });

  // ---------- realtime ----------
  function connect(r: Room) {
    const ch = supabase.channel(`room:${r.id}`, {
      config: { presence: { key: me! }, broadcast: { self: false } },
    });
    channel = ch;

    ch.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${r.id}` },
      (p) => {
        room = p.new as Room;
      },
    )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "options", filter: `room_id=eq.${r.id}` },
        () => fetchOptions(),
      )
      // DELETE ใช้ filter ไม่ได้ → ฟังทั้งหมดแล้วเช็กเอง
      // (replica identity เป็น default: event มีแค่ primary key — options เช็กจาก id, votes/swipes เช็กจาก room_id)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "options" }, (p) => {
        const id = (p.old as Partial<Option>).id;
        if (id && options.some((o) => o.id === id)) fetchOptions();
      });

    if (r.mode === "swipe") {
      ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "swipes", filter: `room_id=eq.${r.id}` },
        (p) => {
          // INSERT/UPDATE: ใส่ผลลงรายการเลย ไม่ต้อง query ใหม่ทุกครั้งที่ใครปัด
          const s = p.new as Partial<Swipe>;
          if (p.eventType === "DELETE" || !s.option_id || !s.voter_id) return;
          swipes = [
            ...swipes.filter((x) => !(x.voter_id === s.voter_id && x.option_id === s.option_id)),
            s as Swipe,
          ];
        },
      ).on("postgres_changes", { event: "DELETE", schema: "public", table: "swipes" }, (p) => {
        if ((p.old as Partial<Swipe>).room_id === r.id) fetchSwipes();
      });
    } else {
      ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes", filter: `room_id=eq.${r.id}` },
        () => fetchVotes(),
      ).on("postgres_changes", { event: "DELETE", schema: "public", table: "votes" }, (p) => {
        if ((p.old as Partial<Vote>).room_id === r.id) fetchVotes();
      });
    }

    ch
      // host สั่งหมุนวงล้อตัดสิน → ทุกเครื่องหมุนไปหยุดที่ชิ้นเดียวกัน
      .on("broadcast", { event: "tiebreak" }, ({ payload }) => {
        startTiebreak(payload as TiebreakPayload);
      })
      .on("presence", { event: "sync" }, () => {
        const state = ch.presenceState<{ name: string; ready: boolean; at: number }>();
        members = Object.entries(state).map(([id, metas]) => {
          const m = metas[metas.length - 1];
          return { id, name: m.name, ready: m.ready, at: m.at };
        });

        // ห้องเต็ม: เรียงตามลำดับเข้าห้อง (เจ้าของห้องมาก่อนเสมอ) ใครเกินเพดานถือว่าเข้าไม่ได้
        if (!roomFull && members.length > MAX_MEMBERS) {
          const order = [...members].sort((a, b) =>
            a.id === r.host_id ? -1 : b.id === r.host_id ? 1 : a.at - b.at,
          );
          if (order.findIndex((m) => m.id === me) >= MAX_MEMBERS) {
            roomFull = true;
            void ch.untrack();
          }
        }
      })
      .subscribe((status) => {
        connected = status === "SUBSCRIBED";
        if (connected) {
          // หลุดแล้วกลับมาเชื่อมต่อได้ → ดึงข้อมูลที่พลาดไประหว่างนั้น
          if (hadConnected) void resync();
          hadConnected = true;
        }
      });
  }

  // ---------- ซิงก์ข้อมูลใหม่หลังกลับมาออนไลน์ ----------
  // มือถือ (โดยเฉพาะ Safari) พักแท็บแล้ว WebSocket หลุด event ที่เกิดระหว่างนั้นจะหายไป
  // จึงดึงสถานะล่าสุดจากฐานข้อมูลใหม่ทุกครั้งที่กลับมาที่แท็บ / กลับมามีเน็ต / ต่อ Realtime ได้อีกครั้ง
  async function resync() {
    if (!room || destroyed) return;
    const now = Date.now();
    if (now - lastSync < 1500) return; // กันเรียกซ้ำถี่ ๆ
    lastSync = now;

    try {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", room.id)
        .maybeSingle();
      if (error) return; // เน็ตยังไม่พร้อม ไว้รอบหน้า
      if (!data) {
        notFound = true; // หายไป = หมดอายุ/ถูกลบแล้ว
        return;
      }
      room = data as Room;
      await Promise.all([fetchOptions(), room.mode === "swipe" ? fetchSwipes() : fetchVotes()]);
      await announce(); // ส่งสถานะตัวเอง (ชื่อ/พร้อม) ให้เพื่อนเห็นอีกครั้ง
    } catch {
      /* ออฟไลน์อยู่ — รอรอบหน้า */
    }
  }

  function onVisible() {
    if (document.hidden) return;
    try {
      // ถ้า socket หลุดจริง ๆ ให้ต่อใหม่ (ปกติ supabase-js ต่อเองอยู่แล้ว นี่คือตัวช่วยสำรอง)
      if (!supabase.realtime.isConnected()) supabase.realtime.connect();
    } catch {
      /* ไม่เป็นไร */
    }
    void resync();
  }

  async function announce() {
    if (!channel || !connected || !name || roomFull) return;
    await channel.track({ name, ready: isHost || ready, at: joinedAt });
  }

  // ประกาศสถานะตัวเองใหม่ทุกครั้งที่ชื่อ / ready / การเชื่อมต่อเปลี่ยน
  $effect(() => {
    name;
    ready;
    connected;
    isHost;
    announce();
  });

  // เริ่มรอบใหม่ → ทุกคนต้องกดพร้อมใหม่ + ล้างสถานะวงล้อตัดสิน
  $effect(() => {
    if (room?.status === "lobby") {
      ready = false;
      tbItems = null;
      tbSeen = false;
      pendingSwipes = {};
    }
  });

  // ---------- นับถอยหลังอัตโนมัติ ----------
  // ทุกเครื่องนับเองจากสถานะที่ซิงก์กันอยู่แล้ว (presence / options) — เจ้าของห้องเป็นคนลงมือตอนนับจบ
  function runCountdown(
    seconds: number,
    text: (n: number) => string,
    onTick: (n: number) => void,
    onDone: () => void,
  ) {
    let n = seconds;
    const id = toast.show(text(n), 0); // 0 = ค้างไว้จนกว่าจะนับจบ/ยกเลิก
    onTick(n);
    feedback.tap();
    const timer = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(timer);
        toast.dismiss(id);
        onDone();
        return;
      }
      toast.update(id, text(n));
      onTick(n);
      feedback.tap();
    }, 1000);
    return {
      stop() {
        clearInterval(timer);
        toast.dismiss(id);
      },
    };
  }

  // ทุกคนพร้อม → นับ 5 วิแล้วเริ่มโหวต (host ยังกดเริ่มเองได้ทันที)
  $effect(() => {
    if (!autoStartOk) return;
    let finished = false;
    // untrack: toast/feedback อ่าน $state ภายใน ไม่ให้ effect นี้ไปติดตามแล้วรีสตาร์ทตัวเอง
    const cd = untrack(() =>
      runCountdown(
        5,
        (n) => `ทุกคนพร้อมแล้ว เริ่ม${verb}ใน ${n}…`,
        (n) => (lobbyCd = n),
        () => {
          finished = true;
          lobbyCd = null;
          if (isHost) startVoting();
        },
      ),
    );
    return () => {
      cd.stop();
      lobbyCd = null;
      // มีคนยกเลิกพร้อม/เข้าห้องใหม่/ลบตัวเลือก ระหว่างนับ (ไม่ใช่เพราะเริ่มโหวตไปแล้ว)
      if (!finished && !destroyed && room?.status === "lobby") {
        toast.show("ยกเลิกการนับถอยหลัง");
      }
    };
  });

  // ทุกคนโหวตครบ → นับ 5 วิแล้วประกาศผล (host กดประกาศเองก่อนได้)
  $effect(() => {
    if (!autoFinishOk) return;
    let finished = false;
    const cd = untrack(() =>
      runCountdown(
        5,
        (n) => `ทุกคน${verb}ครบแล้ว ประกาศผลใน ${n}…`,
        (n) => (voteCd = n),
        () => {
          finished = true;
          voteCd = null;
          if (isHost) finish();
        },
      ),
    );
    return () => {
      cd.stop();
      voteCd = null;
      // มีคนเข้าห้องใหม่ที่ยังไม่ได้โหวตระหว่างนับ (ไม่ใช่เพราะประกาศผลไปแล้ว)
      if (!finished && !destroyed && room?.status === "voting") {
        toast.show("ยกเลิกการนับถอยหลัง");
      }
    };
  });

  // คะแนนเสมอ → นับ 3 วิแล้วหมุนวงล้อตัดสินอัตโนมัติ (host กดหมุนเองก่อนได้)
  $effect(() => {
    if (!autoTiebreakOk) return;
    const cd = untrack(() =>
      runCountdown(
        3,
        (n) => `คะแนนเสมอ! วงล้อจะหมุนใน ${n}…`,
        (n) => (tbCd = n),
        () => {
          tbCd = null;
          if (isHost) spinTiebreak();
        },
      ),
    );
    return () => {
      cd.stop();
      tbCd = null;
    };
  });

  // ---------- เสียง / สั่น ----------
  let knownVoters = new Set<string>();
  $effect(() => {
    const ids = new Set(votes.map((v) => v.voter_id));
    if (room?.status === "voting") {
      // มีคนอื่นโหวตใหม่ → เสียงเบา ๆ (โหวตของตัวเองเล่นตอนกดอยู่แล้ว)
      for (const id of ids) {
        if (!knownVoters.has(id) && id !== me) {
          feedback.tap();
          break;
        }
      }
    }
    knownVoters = ids;
  });

  let prevStatus: string | null = null;
  $effect(() => {
    const s = room?.status ?? null;
    if (prevStatus && s === "voting" && prevStatus !== "voting") feedback.start();
    prevStatus = s;
  });

  let prevWinner: string | null = null;
  $effect(() => {
    const w = room?.winner ?? null;
    if (!loading && w && w !== prevWinner && !tbSeen) feedback.win();
    prevWinner = w;
  });

  // ---------- actions ----------
  function saveName() {
    const n = nameInput.trim();
    if (!n) return;
    name = n.slice(0, 20);
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch {
      /* ไม่เป็นไร */
    }
  }

  const roomUrl = () => `${location.origin}/room/${code}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(roomUrl());
      toast.show("คัดลอกลิงก์แล้ว ส่งให้เพื่อนได้เลย");
    } catch {
      toast.show("คัดลอกไม่ได้ ลองอีกครั้งนะ");
    }
  }

  async function shareLink() {
    if (!navigator.share) return copyLink();
    try {
      await navigator.share({
        title: `แล้วแต่ — ${verb}กับเพื่อน`,
        text: `มา${verb}กัน! รหัสห้อง ${code}`,
        url: roomUrl(),
      });
    } catch {
      /* ผู้ใช้ยกเลิก */
    }
  }

  async function addOption(title: string) {
    const t = title.trim();
    if (!t || !room) return;
    if (options.length >= MAX_OPTIONS) {
      toast.show(limitMessage("LIMIT_OPTIONS")!);
      return;
    }
    const { error } = await supabase
      .from("options")
      .insert({ room_id: room.id, title: t.slice(0, 40) });
    if (error) {
      toast.show(
        limitMessage(error.message) ??
          (error.code === "23505" ? "มีตัวเลือกนี้อยู่แล้ว" : "เพิ่มไม่สำเร็จ"),
      );
      return;
    }
    newItem = "";
  }

  async function addAllSuggestions() {
    if (!room || suggestions.length === 0) return;
    const space = MAX_OPTIONS - options.length;
    if (space <= 0) {
      toast.show(limitMessage("LIMIT_OPTIONS")!);
      return;
    }
    // เพิ่มได้ไม่เกินจำนวนที่เหลือ
    const batch = suggestions.slice(0, space);
    const { error } = await supabase.from("options").upsert(
      batch.map((title) => ({ room_id: room!.id, title })),
      { onConflict: "room_id,title", ignoreDuplicates: true },
    );
    if (error) {
      toast.show(limitMessage(error.message) ?? "เพิ่มไม่สำเร็จ");
      return;
    }
    if (batch.length < suggestions.length) {
      toast.show(`เพิ่มให้ ${batch.length} อย่าง (ตัวเลือกเต็ม ${MAX_OPTIONS} ตัวแล้ว)`);
    }
  }

  async function removeOption(id: string) {
    const { error } = await supabase.from("options").delete().eq("id", id);
    if (error) toast.show("ลบไม่สำเร็จ");
  }

  async function updateRoom(patch: Partial<Room>) {
    if (!room) return false;
    const { error } = await supabase.from("rooms").update(patch).eq("id", room.id);
    if (error) {
      console.error(error);
      toast.show("ทำรายการไม่สำเร็จ ลองอีกครั้งนะ");
      return false;
    }
    return true;
  }

  const startVoting = () => canStart && updateRoom({ status: "voting" });

  async function castVote(optionId: string) {
    if (!room || !me || room.status !== "voting") return;
    feedback.vote();
    const { error } = await supabase.from("votes").upsert(
      { room_id: room.id, voter_id: me, option_id: optionId, voter_name: name },
      { onConflict: "room_id,voter_id" },
    );
    if (error) toast.show(limitMessage(error.message) ?? "โหวตไม่สำเร็จ ลองอีกครั้งนะ");
  }

  // โหมดปัด: บันทึกการปัดหนึ่งใบ (การ์ดถัดไปขึ้นทันที ไม่รอฐานข้อมูล)
  async function swipeCard(optionId: string, liked: boolean) {
    if (!room || !me || room.status !== "voting") return;
    pendingSwipes[optionId] = liked;
    if (liked) feedback.vote();
    else feedback.tap();
    const { error } = await supabase.from("swipes").upsert(
      { room_id: room.id, voter_id: me, option_id: optionId, liked, voter_name: name },
      { onConflict: "room_id,voter_id,option_id" },
    );
    if (error) {
      console.error(error);
      delete pendingSwipes[optionId];
      toast.show(limitMessage(error.message) ?? "ปัดไม่สำเร็จ ลองอีกครั้งนะ");
    }
  }

  async function finish() {
    if (!isHost) return;
    if (activity === 0) {
      toast.show(isSwipe ? "ยังไม่มีใครปัดเลย" : "ยังไม่มีใครโหวตเลย");
      return;
    }
    // เสมอ → ปิดโหวตโดยยังไม่มีผู้ชนะ แล้วให้ host หมุนวงล้อตัดสิน (ทุกคนเห็นพร้อมกัน)
    const winner = tiedOptions.length === 1 ? tiedOptions[0].title : null;
    await updateRoom({ status: "done", winner });
  }

  async function startTiebreak(p: TiebreakPayload) {
    tbSeen = true;
    tbItems = p.items;
    tbSpinning = true;
    // รอให้ Wheel mount (เผื่อ status ห้องยังอัปเดตมาไม่ถึง)
    for (let i = 0; i < 20 && !tbWheel; i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    await tick();
    if (!tbWheel) {
      tbSpinning = false;
      return;
    }
    feedback.start();
    tbWheel.spinTo(p.index, p.jitter);
  }

  async function spinTiebreak() {
    if (!isHost || !channel || tbSpinning) return;
    const items = tiedOptions.map((t) => t.title);
    if (items.length < 2) return;
    const payload: TiebreakPayload = {
      items,
      index: randomInt(items.length),
      jitter: (randomInt(1000) / 1000 - 0.5) * 0.7,
    };
    await channel.send({ type: "broadcast", event: "tiebreak", payload });
    await startTiebreak(payload);
  }

  function onTbResult(item: string) {
    tbSpinning = false;
    feedback.win();
    // host เป็นคนบันทึกผู้ชนะ → ทุกคนเห็นผลสุดท้ายผ่าน Realtime
    if (isHost) updateRoom({ status: "done", winner: item });
  }

  async function newRound() {
    if (!room || !isHost) return;
    const { error } = await supabase
      .from(isSwipe ? "swipes" : "votes")
      .delete()
      .eq("room_id", room.id);
    if (error) return toast.show("เริ่มรอบใหม่ไม่สำเร็จ");
    await updateRoom({ status: "lobby", winner: null });
  }

  // ---------- shared classes ----------
  const btnPrimary =
    "inline-flex items-center justify-center rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";
  const btnGhost =
    "inline-flex items-center justify-center rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-800 transition hover:bg-stone-100 active:scale-[0.98] disabled:opacity-50";
  const card = "rounded-2xl border border-stone-200 bg-white p-5";

  const steps = [
    { key: "lobby", label: "เตรียมตัว" },
    { key: "voting", label: "โหวต" },
    { key: "done", label: "ผลลัพธ์" },
  ] as const;
</script>

<svelte:head>
  <title>ห้อง {code} — แล้วแต่</title>
</svelte:head>

<!-- กลับมามีเน็ต / กลับมาที่แท็บ → ดึงข้อมูลล่าสุด -->
<svelte:window ononline={onVisible} />
<svelte:document onvisibilitychange={onVisible} />

<main class="mx-auto max-w-md px-5 pt-6 pb-16">
  {#if loading}
    <p class="py-24 text-center text-stone-500">กำลังเข้าห้อง…</p>
  {:else if notFound}
    <div class="py-20 text-center">
      <p class="text-5xl" aria-hidden="true">🔍</p>
      <h1 class="mt-4 text-xl font-bold">ไม่พบห้อง {code}</h1>
      <p class="mt-1 text-sm text-stone-500">
        เช็กรหัสอีกครั้ง หรือห้องอาจหมดอายุแล้ว (ห้องที่ไม่มีการใช้งานนานราว 6 ชั่วโมงจะถูกปิด)
      </p>
      <a href="/vote" class="{btnPrimary} mt-6">กลับไปหน้าโหวต</a>
    </div>
  {:else if fatal}
    <p class="py-24 text-center text-stone-600">{fatal}</p>
  {:else if roomFull}
    <div class="py-20 text-center">
      <p class="text-5xl" aria-hidden="true">🚪</p>
      <h1 class="mt-4 text-xl font-bold">ห้อง {code} เต็มแล้ว</h1>
      <p class="mt-1 text-sm text-stone-500">ห้องหนึ่งรองรับได้สูงสุด {MAX_MEMBERS} คน</p>
      <a href="/vote" class="{btnPrimary} mt-6">สร้างห้องใหม่</a>
    </div>
  {:else if room}
    {#if !connected}
      <div
        class="mb-4 rounded-xl border border-stone-300 bg-stone-100 px-3 py-2 text-center text-xs text-stone-600"
        role="status"
      >
        ⚠️ การเชื่อมต่อหลุด กำลังเชื่อมต่อใหม่… ข้อมูลอาจยังไม่เป็นปัจจุบัน
      </div>
    {/if}
    <!-- ===== ส่วนหัวห้อง: รหัส + แชร์ + สถานะการเชื่อมต่อ ===== -->
    <section class={card}>
      <div class="flex items-center justify-between">
        <span class="text-sm text-stone-500">
          {category.emoji}
          {category.name} · {isSwipe ? "ปัดกับเพื่อน" : "โหวตกับเพื่อน"}
        </span>
        <span
          class="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600"
          role="status"
        >
          <span
            class="size-2 rounded-full {connected ? 'bg-emerald-500' : 'animate-pulse bg-amber-400'}"
          ></span>
          {connected ? "เชื่อมต่อแล้ว" : "กำลังเชื่อมต่อ…"}
        </span>
      </div>

      <p class="mt-3 text-xs text-stone-400">รหัสห้อง</p>
      <p class="font-mono text-4xl font-extrabold tracking-[0.3em]">{code}</p>
      <p class="mt-1 text-xs text-stone-400">
        ห้องนี้หมดอายุ {new Date(room.expires_at).toLocaleString("th-TH", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>

      <div class="mt-4 flex gap-2">
        <button onclick={copyLink} class="{btnPrimary} flex-1">คัดลอกลิงก์</button>
        <button onclick={shareLink} class={btnGhost}>แชร์</button>
      </div>
    </section>

    <!-- ===== ขั้นตอน ===== -->
    <ol class="mt-4 flex items-center justify-center gap-2 text-xs" aria-label="ขั้นตอน">
      {#each steps as s, i (s.key)}
        {@const active = room.status === s.key}
        <li
          class="flex items-center gap-2 {active ? 'font-bold text-stone-900' : 'text-stone-400'}"
          aria-current={active ? "step" : undefined}
        >
          <span
            class="flex size-5 items-center justify-center rounded-full text-[11px] {active
              ? 'bg-stone-900 text-white'
              : 'bg-stone-200 text-stone-500'}">{i + 1}</span
          >
          {s.key === "voting" ? verb : s.label}
          {#if i < steps.length - 1}<span class="text-stone-300">—</span>{/if}
        </li>
      {/each}
    </ol>

    <!-- ===== คนในห้อง ===== -->
    <section class="{card} mt-4">
      <h2 class="text-sm font-bold">ในห้อง ({members.length}/{MAX_MEMBERS})</h2>
      <ul class="mt-3 space-y-2">
        {#each sortedMembers as m (m.id)}
          <li class="flex items-center gap-2.5 text-sm">
            <span class="size-2.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true"></span>
            <span class="min-w-0 flex-1 truncate">
              {m.name}{m.id === me ? " (คุณ)" : ""}
            </span>
            {#if m.id === room.host_id}
              <span class="rounded-full bg-stone-900 px-2 py-0.5 text-[11px] font-semibold text-white">
                เจ้าของห้อง
              </span>
            {:else if room.status === "lobby"}
              <span
                class="rounded-full px-2 py-0.5 text-[11px] font-semibold {m.ready
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-stone-100 text-stone-500'}"
              >
                {m.ready ? "พร้อมแล้ว" : "ยังไม่พร้อม"}
              </span>
            {:else if room.status === "voting"}
              {#if isSwipe}
                {@const done = options.length > 0 && progressOf(m.id) >= options.length}
                <span
                  class="rounded-full px-2 py-0.5 text-[11px] font-semibold {done
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-stone-100 text-stone-500'}"
                >
                  {done ? "ปัดครบแล้ว" : `ปัดแล้ว ${progressOf(m.id)}/${options.length}`}
                </span>
              {:else}
                <span
                  class="rounded-full px-2 py-0.5 text-[11px] font-semibold {votes.some(
                    (v) => v.voter_id === m.id,
                  )
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-stone-100 text-stone-500'}"
                >
                  {votes.some((v) => v.voter_id === m.id) ? "โหวตแล้ว" : "กำลังเลือก"}
                </span>
              {/if}
            {/if}
          </li>
        {:else}
          <li class="text-sm text-stone-400">กำลังเชื่อมต่อ…</li>
        {/each}
      </ul>
      {#if members.length <= 1 && room.status === "lobby"}
        <p class="mt-3 text-xs text-stone-400">ส่งลิงก์หรือรหัสให้เพื่อนเพื่อเข้าห้อง</p>
      {/if}
    </section>

    <!-- ================= LOBBY ================= -->
    {#if room.status === "lobby"}
      <section class="{card} mt-4">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-bold">ตัวเลือก ({options.length}/{MAX_OPTIONS})</h2>
          {#if suggestions.length > 0}
            <button
              onclick={addAllSuggestions}
              class="text-xs text-stone-500 underline underline-offset-4 hover:text-stone-900"
            >
              เพิ่มทั้งหมดจากหมวด
            </button>
          {/if}
        </div>

        <form
          class="mt-3 flex gap-2"
          onsubmit={(e) => {
            e.preventDefault();
            addOption(newItem);
          }}
        >
          <input
            bind:value={newItem}
            maxlength="40"
            placeholder="เพิ่มตัวเลือก…"
            aria-label="เพิ่มตัวเลือก"
            class="min-w-0 flex-1 rounded-full border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm outline-none focus:border-stone-900 focus:bg-white"
          />
          <button type="submit" disabled={options.length >= MAX_OPTIONS} class={btnPrimary}>
            เพิ่ม
          </button>
        </form>
        {#if options.length >= MAX_OPTIONS}
          <p class="mt-2 text-xs text-stone-500">ตัวเลือกเต็มแล้ว ลบบางอันออกถ้าอยากเพิ่มใหม่</p>
        {/if}

        <ul class="mt-4 flex flex-wrap gap-2">
          {#each options as o (o.id)}
            <li
              class="flex items-center gap-0.5 rounded-full border border-stone-200 bg-stone-50 py-0.5 pl-3 text-sm {isHost ||
              o.added_by === me
                ? 'pr-0.5'
                : 'pr-3'}"
            >
              {o.title}
              {#if isHost || o.added_by === me}
                <button
                  onclick={() => removeOption(o.id)}
                  aria-label="ลบ {o.title}"
                  class="flex size-6 items-center justify-center rounded-full text-stone-400 hover:bg-stone-200 hover:text-stone-900"
                >
                  ×
                </button>
              {/if}
            </li>
          {:else}
            <li class="text-sm text-stone-400">ยังไม่มีตัวเลือก ลองเพิ่มด้านบน หรือกดจากรายการแนะนำ</li>
          {/each}
        </ul>

        {#if suggestions.length > 0}
          <p class="mt-4 text-xs text-stone-400">แนะนำ (แตะเพื่อเพิ่ม)</p>
          <ul class="mt-2 flex flex-wrap gap-1.5">
            {#each suggestions as s (s)}
              <li>
                <button
                  onclick={() => addOption(s)}
                  class="rounded-full border border-dashed border-stone-300 px-3 py-1 text-sm text-stone-600 hover:border-stone-900 hover:text-stone-900"
                >
                  + {s}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <!-- พร้อม / เริ่มโหวต -->
      <section class="mt-4">
        {#if isHost}
          <button onclick={startVoting} disabled={!canStart} class="{btnPrimary} w-full py-4 text-base">
            {lobbyCd !== null ? "เริ่มเลยตอนนี้" : `เริ่ม${verb}`}
          </button>
          <p class="mt-2 text-center text-xs text-stone-500" role="status">
            {#if options.length < 2}
              ต้องมีอย่างน้อย 2 ตัวเลือก
            {:else if notReady.length > 0}
              รอ {notReady.map((m) => m.name).join(", ")} กดพร้อม
            {:else if lobbyCd !== null}
              เริ่มอัตโนมัติใน {lobbyCd} วินาที (หรือกดเริ่มเลยก็ได้)
            {:else}
              ทุกคนพร้อมแล้ว เริ่มได้เลย 🎉
            {/if}
          </p>
        {:else}
          <button
            onclick={() => {
              ready = !ready;
              feedback.tap();
            }}
            aria-pressed={ready}
            class="w-full rounded-full py-4 text-base font-semibold transition active:scale-[0.98] {ready
              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
              : 'bg-stone-900 text-white hover:bg-stone-700'}"
          >
            {ready ? "✓ พร้อมแล้ว (กดอีกครั้งเพื่อยกเลิก)" : "พร้อมแล้ว"}
          </button>
          <p class="mt-2 text-center text-xs text-stone-500" role="status">
            {#if !ready}
              เพิ่มตัวเลือกให้ครบ แล้วกดพร้อม
            {:else if lobbyCd !== null}
              ทุกคนพร้อมแล้ว เริ่ม{verb}ใน {lobbyCd}…
            {:else}
              รอเจ้าของห้องเริ่ม{verb}…
            {/if}
          </p>
        {/if}
      </section>

      <!-- ================= VOTING ================= -->
    {:else if room.status === "voting"}
      {#if isSwipe}
        <!-- โหมดปัด: การ์ดทีละใบ -->
        <section class="{card} mt-4">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold">ปัดขวา = เอา · ปัดซ้าย = ไม่เอา</h2>
            <span class="text-xs text-stone-500" role="status">
              ปัดแล้ว {options.length - deck.length}/{options.length}
            </span>
          </div>
          <div class="mt-5">
            <SwipeDeck cards={deck} emoji={category.emoji} onswipe={swipeCard} />
          </div>
          <p class="mt-4 text-center text-xs text-stone-400" role="status">
            ปัดครบแล้ว {votedCount}/{members.length} คน
          </p>
        </section>
      {:else}
      <section class="{card} mt-4">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-bold">เลือก 1 อย่าง</h2>
          <span class="text-xs text-stone-500" role="status">
            โหวตแล้ว {votedCount}/{members.length} คน
          </span>
        </div>

        <ul class="mt-3 space-y-2">
          {#each tally as o (o.id)}
            {@const pct = votes.length ? (o.count / votes.length) * 100 : 0}
            {@const mine = myVote === o.id}
            <li>
              <button
                onclick={() => castVote(o.id)}
                aria-pressed={mine}
                class="relative w-full overflow-hidden rounded-2xl border p-4 text-left transition active:scale-[0.99] {mine
                  ? 'border-stone-900'
                  : 'border-stone-200 hover:border-stone-400'}"
              >
                <span
                  class="absolute inset-y-0 left-0 bg-stone-100 transition-[width] duration-500"
                  style="width: {pct}%"
                  aria-hidden="true"
                ></span>
                <span class="relative flex items-center justify-between gap-3">
                  <span class="font-medium">
                    {#if mine}<span aria-hidden="true">✓ </span>{/if}{o.title}
                  </span>
                  <span class="text-sm text-stone-500 tabular-nums">{o.count}</span>
                </span>
              </button>
            </li>
          {/each}
        </ul>
      </section>
      {/if}

      <section class="mt-4">
        {#if isHost}
          <button
            onclick={finish}
            disabled={activity === 0}
            class="w-full rounded-full py-4 text-base font-semibold transition active:scale-[0.98] disabled:opacity-40 {allVoted
              ? 'bg-brand text-white hover:opacity-90'
              : 'bg-stone-900 text-white hover:bg-stone-700'}"
          >
            {voteCd !== null
              ? "ประกาศผลเลยตอนนี้"
              : allVoted
                ? `ทุกคน${verb}ครบแล้ว — ประกาศผล`
                : `ปิด${verb}และประกาศผล`}
          </button>
          {#if voteCd !== null}
            <p class="mt-2 text-center text-xs text-stone-500" role="status">
              ประกาศผลอัตโนมัติใน {voteCd} วินาที (หรือกดประกาศเลยก็ได้)
            </p>
          {/if}
        {:else}
          <p class="text-center text-sm text-stone-500" role="status">
            {#if voteCd !== null}
              ทุกคน{verb}ครบแล้ว ประกาศผลใน {voteCd}…
            {:else if isSwipe}
              {deck.length === 0 ? "ปัดครบแล้ว รอเพื่อน ๆ…" : "ปัดขวาเพื่อเอา ปัดซ้ายเพื่อไม่เอา"}
            {:else if myVote}
              โหวตแล้ว เปลี่ยนใจได้จนกว่าเจ้าของห้องจะปิดโหวต
            {:else}
              แตะตัวเลือกเพื่อโหวต
            {/if}
          </p>
        {/if}
      </section>

      <!-- ================= DONE ================= -->
    {:else if showWheel}
      <!-- คะแนนเสมอ: หมุนวงล้อตัดสิน (ทุกเครื่องเห็นพร้อมกัน) -->
      <section class="{card} mt-4 text-center">
        <p class="text-sm text-stone-500">คะแนนเสมอ {wheelItems.length} อย่าง 🎲</p>
        <p class="mt-1 font-bold">หมุนวงล้อตัดสิน</p>
        <div class="mt-8 px-2">
          <Wheel bind:this={tbWheel} items={wheelItems} onresult={onTbResult} />
        </div>
        {#if isHost}
          <button
            onclick={spinTiebreak}
            disabled={tbSpinning}
            class="{btnPrimary} mt-8 w-full py-4 text-base"
          >
            {tbSpinning ? "กำลังหมุน…" : tbCd !== null ? "หมุนเลยตอนนี้" : "หมุนเลย!"}
          </button>
          {#if tbCd !== null}
            <p class="mt-2 text-xs text-stone-500" role="status">
              หมุนอัตโนมัติใน {tbCd} วินาที
            </p>
          {/if}
        {:else}
          <p class="mt-8 text-sm text-stone-500" role="status">
            {#if tbSpinning}
              กำลังหมุน…
            {:else if tbCd !== null}
              วงล้อจะหมุนใน {tbCd}…
            {:else}
              รอเจ้าของห้องหมุนวงล้อ…
            {/if}
          </p>
        {/if}
      </section>
    {:else}
      <section class="{card} mt-4 text-center">
        <p class="text-sm text-stone-500">ผลโหวต — เอาอันนี้!</p>
        <p class="mt-2 text-4xl font-extrabold tracking-tight">
          <span aria-hidden="true">{category.emoji}</span>
          {room.winner}
        </p>
        {#if tiedCount > 1}
          <p class="mt-2 text-xs text-stone-500">คะแนนเสมอ {tiedCount} อย่าง หมุนวงล้อตัดสินแล้ว 🎲</p>
        {/if}
        {#if category.maps && room.winner}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="{btnGhost} mt-4"
          >
            📍 ค้นหาใกล้ตัวใน Google Maps
          </a>
          {#if nearby.supported && !nearby.coords}
            <button
              onclick={() => nearby.request()}
              disabled={nearby.asking}
              class="mt-2 block w-full text-center text-xs text-stone-400 underline underline-offset-4 hover:text-stone-700 disabled:opacity-50"
            >
              {nearby.asking ? "กำลังหาตำแหน่ง…" : "ใช้ตำแหน่งจริงของเครื่องให้แม่นขึ้น"}
            </button>
          {/if}
        {/if}
      </section>

      <section class="{card} mt-4">
        <h2 class="text-sm font-bold">คะแนนทั้งหมด</h2>
        <ul class="mt-3 space-y-3">
          {#each ranking as o (o.id)}
            <li>
              <div class="flex items-center justify-between text-sm">
                <span class={o.title === room.winner ? "font-bold" : ""}>{o.title}</span>
                <span class="text-stone-500 tabular-nums">{o.count}</span>
              </div>
              {#if o.voters.length}
                <p class="mt-0.5 text-xs text-stone-400">{o.voters.join(", ")}</p>
              {/if}
            </li>
          {/each}
        </ul>
      </section>

      <section class="mt-4">
        {#if isHost}
          <button onclick={newRound} class="{btnPrimary} w-full py-4 text-base">เริ่มรอบใหม่</button>
        {:else}
          <p class="text-center text-sm text-stone-500" role="status">
            รอเจ้าของห้องเริ่มรอบใหม่…
          </p>
        {/if}
      </section>
    {/if}
  {/if}
</main>

<!-- Dialog: ถามชื่อก่อนเข้าห้อง -->
<Dialog.Root
  open={!loading && !notFound && !fatal && !name}
  onOpenChange={() => {}}
>
  <Dialog.Portal>
    <Dialog.Overlay
      class="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
    />
    <Dialog.Content
      interactOutsideBehavior="ignore"
      escapeKeydownBehavior="ignore"
      class="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-7 shadow-xl outline-none data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in"
    >
      <Dialog.Title class="text-xl font-extrabold tracking-tight">
        เพื่อน ๆ เรียกคุณว่าอะไร?
      </Dialog.Title>
      <Dialog.Description class="mt-1 text-sm text-stone-500">
        ชื่อนี้จะแสดงให้คนในห้อง {code} เห็น
      </Dialog.Description>
      <form
        class="mt-5 flex flex-col gap-3"
        onsubmit={(e) => {
          e.preventDefault();
          saveName();
        }}
      >
        <input
          bind:value={nameInput}
          maxlength="20"
          placeholder="ชื่อเล่น"
          aria-label="ชื่อเล่น"
          class="rounded-full border border-stone-200 bg-stone-50 px-4 py-3 text-center outline-none focus:border-stone-900 focus:bg-white"
        />
        <button type="submit" disabled={!nameInput.trim()} class="{btnPrimary} py-3.5">
          เข้าห้อง
        </button>
      </form>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
