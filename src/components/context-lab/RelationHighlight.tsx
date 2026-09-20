export function RelationHighlight({ caption }: { caption: string }) {
  return (
    <p
      data-relation-caption=""
      className="bg-card rounded-2xl px-4 py-3 text-center text-sm font-medium ring-1 ring-black/5"
    >
      {caption}
    </p>
  );
}
