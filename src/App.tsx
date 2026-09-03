import { Button } from '@/components/ui/button';

function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-2xl text-center">
        <div className="mb-6 inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
          ParkEase
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Smart Parking Management
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground">
          A smarter way to discover, reserve, manage, and operate parking spaces.
        </p>

        <div className="mt-8 flex justify-center gap-3">
          <Button>Find Parking</Button>
          <Button variant="outline">Manage Parking</Button>
        </div>
      </div>
    </main>
  );
}

export default App;
