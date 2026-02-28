export default function App() {
  const appName = window.electronAPI?.appName ?? "Enterprise Software Electron";

  return (
    <main>
      <h1>{appName}</h1>
      <p>React renderer is running.</p>
    </main>
  );
}
