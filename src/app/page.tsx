import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-xl flex-col justify-center gap-6 px-6 py-16">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">WordRanger</h1>
        <p className="text-muted-foreground text-base">
          Game-based vocabulary learning engine
        </p>
      </div>
      <Link
        href="/debug/learning"
        className="text-sm font-medium underline underline-offset-4"
      >
        Open Learning Core Debug Lab
      </Link>
    </main>
  );
}
