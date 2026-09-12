"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ActionStatus, AssistantMessage } from "./assistant-types";
import { api } from "./client";

export const CHATS_URL = "/api/admin/assistant/chats";

type AssistantState = {
  /** null until the server creates the chat with the first answer. */
  chatId: string | null;
  messages: AssistantMessage[];
  draft: string;
  attachments: string[];
  pendingSince: number | null;
  loading: boolean;
  unread: boolean;
  /** Bumped whenever another chat is shown, so a late answer doesn't land in the wrong one. */
  view: number;
  setDraft: (draft: string) => void;
  setAttachments: (update: (keys: string[]) => string[]) => void;
  send: (text: string) => Promise<void>;
  newChat: () => void;
  openChat: (chatId: string) => Promise<void>;
  refresh: () => Promise<void>;
  forget: (chatId: string) => void;
  setActionStatus: (messageId: string, index: number, status: Exclude<ActionStatus, "pending">) => Promise<void>;
  markRead: () => void;
};

export const useAssistant = create<AssistantState>()(
  persist(
    (set, get) => ({
      chatId: null,
      messages: [],
      draft: "",
      attachments: [],
      pendingSince: null,
      loading: false,
      unread: false,
      view: 0,
      setDraft: (draft) => set({ draft }),
      setAttachments: (update) => set((s) => ({ attachments: update(s.attachments) })),
      send: async (text) => {
        const content = text.trim();
        const { messages, pendingSince, chatId, view, attachments } = get();
        if (!content || pendingSince !== null) return;

        const question: AssistantMessage = {
          id: `pending-${Date.now()}`,
          role: "user",
          content,
          images: attachments,
          tools: [],
          actions: [],
          replies: [],
        };
        set({ messages: [...messages, question], draft: "", attachments: [], pendingSince: Date.now() });
        try {
          const saved = await api<{ chatId: string; messages: AssistantMessage[] }>("/api/admin/assistant", {
            body: { chatId, message: content, imageKeys: attachments },
          });
          void mutate(CHATS_URL);
          if (get().view !== view) {
            toast("Your earlier question was answered", { description: "Find it in History." });
            return;
          }
          set({ chatId: saved.chatId, messages: [...messages, ...saved.messages], pendingSince: null, unread: true });
        } catch (err) {
          if (get().view !== view) return;
          toast.error((err as Error).message);
          set({ messages, draft: content, attachments, pendingSince: null });
        }
      },
      newChat: () =>
        set((s) => ({
          chatId: null,
          messages: [],
          pendingSince: null,
          loading: false,
          unread: false,
          view: s.view + 1,
        })),
      openChat: async (chatId) => {
        if (chatId === get().chatId && get().pendingSince === null) return;
        set((s) => ({ chatId, messages: [], pendingSince: null, loading: true, unread: false, view: s.view + 1 }));
        try {
          const chat = await api<{ messages: AssistantMessage[] }>(`${CHATS_URL}/${chatId}`);
          if (get().chatId === chatId) set({ messages: chat.messages, loading: false });
        } catch (err) {
          toast.error((err as Error).message);
          if (get().chatId === chatId) get().newChat();
        }
      },
      refresh: async () => {
        const { chatId, view, pendingSince } = get();
        if (!chatId || pendingSince !== null) return;
        try {
          const chat = await api<{ messages: AssistantMessage[] }>(`${CHATS_URL}/${chatId}`);
          if (get().view === view && get().chatId === chatId) set({ messages: chat.messages });
        } catch {
          // Deleted from another tab or device.
          if (get().view === view && get().chatId === chatId) get().newChat();
        }
      },
      forget: (chatId) => {
        if (get().chatId === chatId) get().newChat();
      },
      setActionStatus: async (messageId, index, status) => {
        const patch = (value: ActionStatus) =>
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === messageId
                ? { ...m, actions: m.actions.map((a, i) => (i === index ? { ...a, status: value } : a)) }
                : m,
            ),
          }));
        patch(status);
        try {
          await api(`/api/admin/assistant/messages/${messageId}`, { method: "PATCH", body: { index, status } });
        } catch (err) {
          // The purchase/location is already saved; only the card's state didn't stick, so don't revert.
          toast.error((err as Error).message);
        }
      },
      markRead: () => set({ unread: false }),
    }),
    {
      name: "potatoni-assistant",
      storage: createJSONStorage(() => sessionStorage),
      partialize: ({ chatId, messages, draft, attachments }) => ({ chatId, messages, draft, attachments }),
      // Rehydrated after mount (useAssistantSession) so server and first client render match.
      skipHydration: true,
    },
  ),
);

export function useAssistantSession(visible: boolean) {
  const unread = useAssistant((s) => s.unread);
  const markRead = useAssistant((s) => s.markRead);

  useEffect(() => {
    if (useAssistant.persist.hasHydrated()) return;
    void Promise.resolve(useAssistant.persist.rehydrate()).then(() => useAssistant.getState().refresh());
  }, []);

  useEffect(() => {
    if (visible && unread) markRead();
  }, [visible, unread, markRead]);
}
