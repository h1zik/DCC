import { useEffect, useRef, type RefObject } from "react";

/** Kembalikan fokus ke composer setelah kirim/edit selesai (textarea sempat `disabled` saat pending). */
export function useChatComposerFocus(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  pending: boolean,
) {
  const shouldFocusRef = useRef(false);

  const scheduleComposerFocus = () => {
    shouldFocusRef.current = true;
  };

  useEffect(() => {
    if (!pending && shouldFocusRef.current) {
      shouldFocusRef.current = false;
      requestAnimationFrame(() => {
        textareaRef.current?.focus({ preventScroll: true });
      });
    }
  }, [pending, textareaRef]);

  return scheduleComposerFocus;
}

/** Cegah tombol Kirim mencuri fokus dari textarea saat diklik. */
export function preventComposerBlur(e: React.MouseEvent) {
  e.preventDefault();
}
