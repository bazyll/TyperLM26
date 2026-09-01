"use client";

import { useState } from "react";
import { AnnouncementItem, AnnouncementCommentItem } from "@/types";
import { addCommentAction, updateCommentAction, deleteCommentAction } from "@/lib/announcements/actions";
import {
  Pin,
  MessageSquare,
  Send,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Shield,
  Loader2,
} from "lucide-react";

interface Props {
  initialAnnouncements: AnnouncementItem[];
  currentUserId?: string;
  isAdmin?: boolean;
}

export function AnnouncementsFeed({ initialAnnouncements, currentUserId, isAdmin }: Props) {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(initialAnnouncements);
  const [expandedAnnId, setExpandedAnnId] = useState<string | null>(initialAnnouncements[0]?.id || null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const handleAddComment = async (announcementId: string) => {
    const text = (commentInputs[announcementId] || "").trim();
    if (!text) return;

    setIsSubmitting(true);
    setFeedback(null);

    const res = await addCommentAction({
      announcementId,
      content: text,
    });

    setIsSubmitting(false);

    if (res.success) {
      setCommentInputs((prev) => ({ ...prev, [announcementId]: "" }));
      // Reload comments in-place
      setFeedback({ success: true, message: "Komentarz został dodany." });
      setTimeout(() => setFeedback(null), 3000);
      window.location.reload();
    } else {
      setFeedback({ success: false, message: res.error || "Błąd dodawania komentarza." });
    }
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editContent.trim()) return;

    setIsSubmitting(true);
    const res = await updateCommentAction({
      commentId,
      content: editContent.trim(),
    });
    setIsSubmitting(false);

    if (res.success) {
      setEditingCommentId(null);
      setEditContent("");
      window.location.reload();
    } else {
      setFeedback({ success: false, message: res.error || "Błąd edycji komentarza." });
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć ten komentarz?")) return;

    const res = await deleteCommentAction(commentId);
    if (res.success) {
      window.location.reload();
    } else {
      setFeedback({ success: false, message: res.error || "Błąd usuwania komentarza." });
    }
  };

  if (announcements.length === 0) {
    return (
      <div className="p-12 text-center rounded-3xl bg-slate-900 border border-slate-800">
        <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-1">Brak ogłoszeń</h3>
        <p className="text-xs text-slate-400">Organizator nie opublikował jeszcze żadnych ogłoszeń.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-sm font-medium flex items-center gap-3 transition-all ${
            feedback.success
              ? "bg-emerald-950/60 border-emerald-500/30 text-emerald-300"
              : "bg-rose-950/60 border-rose-500/30 text-rose-300"
          }`}
        >
          {feedback.success ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {announcements.map((ann) => {
        const isExpanded = expandedAnnId === ann.id;

        return (
          <article
            key={ann.id}
            className={`p-6 rounded-3xl border transition-all ${
              ann.isPinned
                ? "bg-gradient-to-b from-blue-950/40 to-slate-900 border-blue-500/30 shadow-xl shadow-blue-500/5"
                : "bg-slate-900/90 border-slate-800"
            }`}
          >
            {/* Header: Pinned tag, Author, Date */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center justify-center font-bold text-xs">
                  {ann.authorName.charAt(0)}
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">{ann.authorName}</span>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(ann.createdAt).toLocaleString("pl-PL", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>

              {ann.isPinned && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  <Pin className="w-3 h-3" /> Przypięte
                </span>
              )}
            </div>

            {/* Title */}
            <h2 className="text-lg sm:text-xl font-extrabold text-white mb-2">{ann.title}</h2>

            {/* Content (Pure Safe Text) */}
            <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed mb-6 font-normal">
              {ann.content}
            </div>

            {/* Comments Toggle Bar */}
            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setExpandedAnnId(isExpanded ? null : ann.id)}
                className="flex items-center gap-2 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>
                  Komentarze ({ann.commentsCount}) {isExpanded ? "▲ Zwiń" : "▼ Rozwiń"}
                </span>
              </button>
            </div>

            {/* Expanded Comments Section */}
            {isExpanded && (
              <div className="mt-4 pt-4 border-t border-slate-800/60 space-y-4">
                {/* Comments List */}
                <div className="space-y-3">
                  {ann.comments && ann.comments.length > 0 ? (
                    ann.comments.map((c) => {
                      const isOwner = currentUserId === c.userId;
                      const canDelete = isOwner || isAdmin;
                      const isEditing = editingCommentId === c.id;

                      return (
                        <div
                          key={c.id}
                          className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex flex-col gap-1.5"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-[10px]">
                                {c.userName.charAt(0)}
                              </div>
                              <span className="font-bold text-slate-200">{c.userName}</span>
                              <span className="text-[10px] text-slate-500">
                                {new Date(c.createdAt).toLocaleTimeString("pl-PL", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2">
                              {isOwner && !isEditing && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCommentId(c.id);
                                    setEditContent(c.content);
                                  }}
                                  className="text-slate-400 hover:text-blue-400 text-[11px] p-1 transition-colors"
                                  title="Edytuj"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canDelete && !isEditing && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteComment(c.id)}
                                  className="text-slate-400 hover:text-rose-400 text-[11px] p-1 transition-colors"
                                  title="Usuń"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Comment Content / Edit Form */}
                          {isEditing ? (
                            <div className="mt-2 space-y-2">
                              <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                maxLength={1000}
                                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
                                rows={2}
                              />
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingCommentId(null)}
                                  className="px-3 py-1 rounded-lg text-xs text-slate-400 hover:text-white"
                                >
                                  Anuluj
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateComment(c.id)}
                                  disabled={isSubmitting}
                                  className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white disabled:opacity-50"
                                >
                                  Zapisz
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-300 whitespace-pre-wrap">{c.content}</p>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-500 italic py-2">Brak komentarzy. Bądź pierwszy!</p>
                  )}
                </div>

                {/* Add Comment Input */}
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    placeholder="Napisz komentarz (maks. 1000 znaków)..."
                    value={commentInputs[ann.id] || ""}
                    onChange={(e) =>
                      setCommentInputs((prev) => ({ ...prev, [ann.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAddComment(ann.id);
                      }
                    }}
                    maxLength={1000}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-white placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddComment(ann.id)}
                    disabled={isSubmitting || !(commentInputs[ann.id] || "").trim()}
                    className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all cursor-pointer"
                    title="Wyślij komentarz"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
