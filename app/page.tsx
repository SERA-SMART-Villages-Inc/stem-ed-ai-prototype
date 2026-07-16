import Link from "next/link";

export default function HomePage() {
  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">K-12 Insights Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          District-to-classroom analytics dashboard prototype. Synthetic data only.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
