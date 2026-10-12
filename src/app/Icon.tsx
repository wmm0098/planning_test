export default function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    cafe: <><path d="M4 5h12v8a5 5 0 0 1-10 0V5M16 6h2a3 3 0 0 1 0 6h-2M3 20h17" /></>,
    sales: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h2M14 11h2M8 15h2M14 15h2M8 18h8"/></>,
    chart: <><path d="M4 4v16h17M8 15l4-5 4 2 5-7"/><path d="M17 5h4v4"/></>,
    stock: <><path d="m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3"/></>,
    edit: <><path d="m15 4 5 5M4 20l4-1L20 7a2 2 0 0 0-4-4L4 15v5Z"/></>,
    delete: <><path d="M3 6h18M9 6V3h6v3M6 6l1 14h10l1-14M10 10v6M14 10v6"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/></>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.info}</svg>;
}
