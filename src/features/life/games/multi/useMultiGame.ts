'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type Role = 'host' | 'guest';

export interface PlayerInfo {
  sabun: string;
  name: string;
  joinedAt: number;
}

interface UseMultiGameOptions<TMove> {
  /** 방 코드 (4자리) */
  roomCode: string;
  /** 게임 종류 (channel namespace 분리) */
  gameKind: 'omok' | 'yutnori';
  /** 호스트 여부 */
  role: Role;
  /** 상대방의 move를 받았을 때 */
  onRemoteMove: (move: TMove, from: PlayerInfo) => void;
  /** 상대방이 게임 재시작을 요청 */
  onRemoteRestart?: () => void;
}

export interface MultiGameAPI<TMove> {
  /** 채널 연결 상태 */
  connected: boolean;
  /** 현재 방의 플레이어 목록 */
  players: PlayerInfo[];
  /** 상대방 정보 (없으면 null) */
  opponent: PlayerInfo | null;
  /** 상대방에게 move 전송 */
  sendMove: (move: TMove) => void;
  /** 상대방에게 게임 재시작 신호 */
  sendRestart: () => void;
  /** 방 떠나기 */
  leave: () => void;
}

/**
 * Supabase Realtime broadcast 기반 2인 턴제 게임 채널 훅.
 *
 * - host가 먼저 입장 후 guest가 join → presence_sync로 두 명 확인
 * - 'move' 브로드캐스트로 수만 동기화 (DB 저장 X)
 */
export function useMultiGame<TMove>(opts: UseMultiGameOptions<TMove>): MultiGameAPI<TMove> {
  const { roomCode, gameKind, role, onRemoteMove, onRemoteRestart } = opts;
  const me = useAuthStore((s) => s.user);
  const [connected, setConnected] = useState(false);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onMoveRef = useRef(onRemoteMove);
  const onRestartRef = useRef(onRemoteRestart);

  useEffect(() => { onMoveRef.current = onRemoteMove; }, [onRemoteMove]);
  useEffect(() => { onRestartRef.current = onRemoteRestart; }, [onRemoteRestart]);

  useEffect(() => {
    if (!supabase || !me?.sabun) return;

    const channelName = `game-${gameKind}-${roomCode}`;
    const myInfo: PlayerInfo = {
      sabun: me.sabun,
      name: me.name ?? '익명',
      joinedAt: Date.now(),
    };

    const channel = supabase.channel(channelName, {
      config: { presence: { key: me.sabun } },
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PlayerInfo>();
        const list: PlayerInfo[] = [];
        for (const key in state) {
          const presences = state[key];
          if (presences && presences.length > 0) {
            list.push(presences[0]);
          }
        }
        list.sort((a, b) => a.joinedAt - b.joinedAt);
        setPlayers(list);
      })
      .on('broadcast', { event: 'move' }, (msg) => {
        const payload = msg.payload as { move: TMove; from: PlayerInfo };
        if (payload.from.sabun === me.sabun) return; // self echo skip
        onMoveRef.current(payload.move, payload.from);
      })
      .on('broadcast', { event: 'restart' }, (msg) => {
        const payload = msg.payload as { from: PlayerInfo };
        if (payload.from.sabun === me.sabun) return;
        onRestartRef.current?.();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(myInfo);
          setConnected(true);
        }
      });

    return () => {
      try { channel.unsubscribe(); } catch { /* ignore */ }
      try { supabase!.removeChannel(channel); } catch { /* ignore */ }
      channelRef.current = null;
      setConnected(false);
    };
  }, [roomCode, gameKind, me?.sabun, me?.name]);

  const sendMove = useCallback((move: TMove) => {
    const ch = channelRef.current;
    if (!ch || !me?.sabun) return;
    const from: PlayerInfo = { sabun: me.sabun, name: me.name ?? '익명', joinedAt: Date.now() };
    ch.send({ type: 'broadcast', event: 'move', payload: { move, from } });
  }, [me?.sabun, me?.name]);

  const sendRestart = useCallback(() => {
    const ch = channelRef.current;
    if (!ch || !me?.sabun) return;
    const from: PlayerInfo = { sabun: me.sabun, name: me.name ?? '익명', joinedAt: Date.now() };
    ch.send({ type: 'broadcast', event: 'restart', payload: { from } });
  }, [me?.sabun, me?.name]);

  const leave = useCallback(() => {
    const ch = channelRef.current;
    if (!ch) return;
    try { ch.unsubscribe(); } catch { /* ignore */ }
    try { supabase?.removeChannel(ch); } catch { /* ignore */ }
    channelRef.current = null;
    setConnected(false);
  }, []);

  const opponent = players.find((p) => p.sabun !== me?.sabun) ?? null;

  // role(host/guest) 정렬: 첫 입장 host가 players[0]
  void role; // 현재 정보용 (presence 정렬은 joinedAt 기준)

  return { connected, players, opponent, sendMove, sendRestart, leave };
}
