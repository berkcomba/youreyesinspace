/**
 * Stream chat as a second way in: viewers type A, B, C or D in Twitch, Kick or YouTube chat instead of
 * opening the crew page. Read-only and anonymous (no login, no bot account): the cockpit just
 * listens, so nothing here can post to the chat or needs a token.
 */

export type ChatSource = 'twitch' | 'kick' | 'youtube';
export type ChatState = 'off' | 'connecting' | 'live' | 'error';
export interface ChatLine { pid: string; nick: string; text: string }

export interface ChatFeed {
  readonly source: ChatSource;
  readonly channel: string;
  state: ChatState;
  error?: string;
  close(): void;
}

const RELAY_HTTP = ((import.meta.env.VITE_XP_SERVER as string | undefined) ?? '').replace(/^ws/, 'http').replace(/\/$/, '');

/** Reconnecting socket with jittered backoff; `open` returns the socket and its handlers. */
function keepAlive(feed: ChatFeed, open: () => Promise<WebSocket>, onChange: () => void): () => void {
  let stopped = false;
  let retry = 0;
  let ws: WebSocket | null = null;
  let timer = 0;
  const set = (s: ChatState, error?: string): void => { feed.state = s; feed.error = error; onChange(); };
  const go = async (): Promise<void> => {
    if (stopped) return;
    set('connecting');
    try {
      ws = await open();
    } catch (err) {
      set('error', (err as Error).message);
      if (!stopped) timer = window.setTimeout(go, 30_000);
      return;
    }
    if (stopped) { ws.close(); return; }
    ws.addEventListener('open', () => { retry = 0; });
    ws.addEventListener('close', () => {
      if (stopped) return;
      set('connecting');
      timer = window.setTimeout(go, Math.min(30_000, 1000 * 2 ** retry++) * (0.5 + Math.random()));
    });
  };
  void go();
  return () => { stopped = true; clearTimeout(timer); ws?.close(); set('off'); };
}

/* ---------------- Twitch: anonymous IRC over WebSocket ---------------- */

function ircTags(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const kv of raw.split(';')) { const i = kv.indexOf('='); out[kv.slice(0, i)] = kv.slice(i + 1); }
  return out;
}

export function twitchChat(channelIn: string, onLine: (l: ChatLine) => void, onChange: () => void): ChatFeed {
  const channel = channelIn.trim().replace(/^#|^https?:\/\/(www\.)?twitch\.tv\//i, '').replace(/\/.*$/, '').toLowerCase();
  const feed: ChatFeed = { source: 'twitch', channel, state: 'off', close: () => {} };
  if (!/^[a-z0-9_]{3,25}$/.test(channel)) { feed.state = 'error'; feed.error = 'Not a Twitch channel name'; return feed; }
  feed.close = keepAlive(feed, async () => {
    const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
    ws.addEventListener('open', () => {
      ws.send('CAP REQ :twitch.tv/tags');
      ws.send('PASS SCHMOOPIIE');   // Twitch's documented anonymous login
      ws.send(`NICK justinfan${10000 + Math.floor(Math.random() * 80000)}`);
      ws.send(`JOIN #${channel}`);
    });
    ws.addEventListener('message', (e) => {
      for (const line of String(e.data).split('\r\n')) {
        if (!line) continue;
        if (line.startsWith('PING')) { ws.send(line.replace('PING', 'PONG')); continue; }
        if (line.includes(' JOIN #') || line.includes(' 366 ')) { if (feed.state !== 'live') { feed.state = 'live'; onChange(); } continue; }
        const m = line.match(/^@(\S+) :(\w+)!\S+ PRIVMSG #\S+ :(.*)$/);
        if (!m) continue;
        const tags = ircTags(m[1]);
        const id = tags['user-id'];
        if (!id) continue;
        onLine({ pid: `tw:${id}`, nick: (tags['display-name'] || m[2]).replace(/\\s/g, ' '), text: m[3] });
      }
    });
    return ws;
  }, onChange);
  return feed;
}

/* ---------------- Kick: the public Pusher channel of the chatroom ---------------- */

export function kickChat(channelIn: string, onLine: (l: ChatLine) => void, onChange: () => void): ChatFeed {
  const channel = channelIn.trim().replace(/^https?:\/\/(www\.)?kick\.com\//i, '').replace(/\/.*$/, '').toLowerCase();
  const feed: ChatFeed = { source: 'kick', channel, state: 'off', close: () => {} };
  if (!/^[a-z0-9_-]{2,40}$/.test(channel)) { feed.state = 'error'; feed.error = 'Not a Kick channel name'; return feed; }
  if (!RELAY_HTTP) { feed.state = 'error'; feed.error = 'Kick chat needs the crew relay (VITE_XP_SERVER)'; return feed; }
  feed.close = keepAlive(feed, async () => {
    const r = await fetch(`${RELAY_HTTP}/kick/${channel}`);
    const j = (await r.json()) as { chatroomId?: number; appKey?: string; cluster?: string; error?: string };
    if (!r.ok || !j.chatroomId || !j.appKey) throw new Error(j.error ?? 'Kick chat is unavailable');
    const ws = new WebSocket(`wss://ws-${j.cluster ?? 'us2'}.pusher.com/app/${j.appKey}?protocol=7&client=js&version=8.4.0&flash=false`);
    ws.addEventListener('message', (e) => {
      let m: { event?: string; data?: string };
      try { m = JSON.parse(String(e.data)); } catch { return; }
      if (m.event === 'pusher:connection_established') ws.send(JSON.stringify({ event: 'pusher:subscribe', data: { auth: '', channel: `chatrooms.${j.chatroomId}.v2` } }));
      else if (m.event === 'pusher:ping') ws.send(JSON.stringify({ event: 'pusher:pong', data: {} }));
      else if (m.event === 'pusher_internal:subscription_succeeded') { feed.state = 'live'; onChange(); }
      else if (m.event?.endsWith('ChatMessageEvent') && m.data) {
        try {
          const x = JSON.parse(m.data) as { content?: string; sender?: { id?: number; username?: string } };
          if (x.sender?.id) onLine({ pid: `kk:${x.sender.id}`, nick: x.sender.username ?? 'Kick viewer', text: x.content ?? '' });
        } catch { /* not a chat line */ }
      }
    });
    return ws;
  }, onChange);
  return feed;
}

/* ---------------- YouTube: the live chat, polled through the relay ---------------- */

export function youtubeChat(refIn: string, onLine: (l: ChatLine) => void, onChange: () => void): ChatFeed {
  const ref = refIn.trim();
  const feed: ChatFeed = { source: 'youtube', channel: ref, state: 'off', close: () => {} };
  if (!ref || ref.length > 200) { feed.state = 'error'; feed.error = 'Not a YouTube channel or video'; return feed; }
  if (!RELAY_HTTP) { feed.state = 'error'; feed.error = 'YouTube chat needs the crew relay (VITE_XP_SERVER)'; return feed; }
  let stopped = false;
  let timer = 0;
  let retry = 0;
  const set = (s: ChatState, error?: string): void => { if (feed.state !== s || feed.error !== error) { feed.state = s; feed.error = error; onChange(); } };
  const later = (ms: number, fn: () => void): void => { if (!stopped) timer = window.setTimeout(fn, ms); };
  const start = async (): Promise<void> => {
    set('connecting');
    try {
      const r = await fetch(`${RELAY_HTTP}/yt/start?ref=${encodeURIComponent(ref)}`);
      const j = (await r.json()) as { k?: string; v?: string; c?: string; error?: string };
      if (!r.ok || !j.k || !j.v || !j.c) throw new Error(j.error ?? 'YouTube chat is unavailable');
      retry = 0;
      // the first answer replays recent chat: skip it, or old "A"s would count as answers
      void poll(j.k, j.v, j.c, true);
    } catch (err) {
      // a channel that is not live yet is the usual case: check again shortly
      set('error', (err as Error).message);
      later(30_000, () => void start());
    }
  };
  const poll = async (k: string, v: string, c: string, first = false): Promise<void> => {
    if (stopped) return;
    try {
      const r = await fetch(`${RELAY_HTTP}/yt/poll?k=${k}&v=${encodeURIComponent(v)}&c=${encodeURIComponent(c)}`);
      const j = (await r.json()) as { lines?: Array<{ ch: string; nick: string; text: string }>; c?: string; wait?: number; error?: string };
      if (r.status === 410) { set('error', j.error ?? 'The stream has ended'); later(30_000, () => void start()); return; }
      if (!r.ok || !j.c) throw new Error(j.error ?? 'YouTube chat is unavailable');
      retry = 0;
      set('live');
      if (!first) for (const l of j.lines ?? []) onLine({ pid: `yt:${l.ch}`, nick: l.nick, text: l.text });
      later(Math.max(1500, Math.min(j.wait ?? 3000, 5000)), () => void poll(k, v, j.c!));
    } catch {
      set('connecting');
      later(Math.min(30_000, 1000 * 2 ** retry++), () => void (retry > 4 ? start() : poll(k, v, c, first)));
    }
  };
  void start();
  feed.close = () => { stopped = true; clearTimeout(timer); set('off'); };
  return feed;
}

/** "A", "b", "!c", "d!" → 0..3; anything else is just chat. */
export function chatSlot(text: string): number {
  const m = text.trim().match(/^!?\s*([abcd])\s*!?$/i);
  return m ? m[1].toLowerCase().charCodeAt(0) - 97 : -1;
}
