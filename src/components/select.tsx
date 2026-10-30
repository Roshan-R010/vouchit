"use client";

import { useEffect, useId, useRef, useState, type SelectHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import "./select.css";

/** Retains the native field for forms and validation, with a consistent menu. */
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const field = useRef<HTMLSelectElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 280 });
  const typed = useRef({ text: "", time: 0 });
  const options = field.current ? Array.from(field.current.options) : [];

  function positionMenu() {
    const element = field.current;
    if (!element || element.disabled) return;
    const rect = element.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 14;
    const above = rect.top - 14;
    const desired = Math.min(280, element.options.length * 40 + 10);
    const upward = below < desired && above > below;
    const maxHeight = Math.max(40, Math.min(desired, upward ? above : below));
    const width = Math.min(Math.max(rect.width, 160), window.innerWidth - 16);
    setPosition({ top: upward ? rect.top - maxHeight - 6 : rect.bottom + 6, left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), width, maxHeight });
  }

  function show() {
    if (!field.current || field.current.disabled) return;
    positionMenu();
    setActive(field.current.selectedIndex);
    setOpen(true);
  }

  function choose(index: number) {
    const element = field.current;
    const option = element?.options[index];
    if (!element || !option || option.disabled) return;
    element.value = option.value;
    // Dispatch a real change event so existing React handlers and form values agree.
    element.dispatchEvent(new Event("change", { bubbles: true }));
    setOpen(false);
    element.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && event.target !== field.current) setOpen(false);
    };
    const close = () => setOpen(false);
    const scroll = (event: Event) => { if (!menu.current?.contains(event.target as Node)) positionMenu(); };
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", close);
    document.addEventListener("scroll", scroll, true);
    return () => { document.removeEventListener("pointerdown", dismiss); window.removeEventListener("resize", close); document.removeEventListener("scroll", scroll, true); };
  }, [open]);
  useEffect(() => {
    const container = menu.current;
    const option = container?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!container || !option) return;
    if (option.offsetTop < container.scrollTop) container.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > container.scrollTop + container.clientHeight) container.scrollTop = option.offsetTop + option.offsetHeight - container.clientHeight;
  }, [active, open]);
  useEffect(() => { if (props.disabled) setOpen(false); }, [props.disabled]);

  return <><select {...props} ref={field} className={`vouch-select ${props.className || ""}`} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? menuId : undefined} aria-activedescendant={open && active >= 0 ? `${menuId}-${active}` : undefined}
    onPointerDown={event => { props.onPointerDown?.(event); if (!event.defaultPrevented && event.button === 0) { event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); if (open) setOpen(false); else show(); } }}
    onMouseDown={event => { props.onMouseDown?.(event); event.preventDefault(); }}
    onClick={event => { props.onClick?.(event); event.preventDefault(); }}
    onBlur={event => { props.onBlur?.(event); setOpen(false); }}
    onKeyDown={event => {
      props.onKeyDown?.(event);
      if (event.defaultPrevented) return;
      if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); return; }
      if (event.key === "Tab") { setOpen(false); return; }
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (open) choose(active); else show(); return; }
      const enabled = Array.from(event.currentTarget.options).map((option, index) => ({ option, index })).filter(({ option }) => !option.disabled && !option.hidden);
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        if (!open) { show(); return; }
        const current = enabled.findIndex(item => item.index === active);
        const next = event.key === "Home" ? 0 : event.key === "End" ? enabled.length - 1 : Math.max(0, Math.min(enabled.length - 1, current + (event.key === "ArrowDown" ? 1 : -1)));
        setActive(enabled[next]?.index ?? -1); return;
      }
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        const now = Date.now();
        const text = (now - typed.current.time < 700 ? typed.current.text : "") + event.key.toLowerCase();
        typed.current = { text, time: now };
        const match = enabled.find(({ option }) => option.label.toLowerCase().startsWith(text));
        if (!open) show();
        if (match) setActive(match.index);
      }
    }}/>
    {open && createPortal(<div ref={menu} id={menuId} className="vouch-select-menu" role="listbox" aria-label={props["aria-label"] || field.current?.labels?.[0]?.textContent?.trim() || "Options"} style={position}>
      {options.map((option, index) => !option.hidden && <div key={`${index}-${option.value}`} id={`${menuId}-${index}`} role="option" aria-selected={option.selected} aria-disabled={option.disabled || undefined} data-active={active === index} data-index={index} className="vouch-select-option" onPointerDown={event => event.preventDefault()} onPointerMove={() => { if (!option.disabled) setActive(index); }} onClick={() => choose(index)}>
        <span>{option.label}</span>{option.selected && <Check size={16} strokeWidth={3} aria-hidden="true"/>}
      </div>)}
    </div>, document.body)}
  </>;
}
