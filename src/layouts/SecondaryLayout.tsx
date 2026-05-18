import Header from "../components/layout/Header";
import Sidebar from "../components/layout/Sidebar";

export default function SecondaryLayout(props: { children: any }) {
  return (
    <>
      <Header />
      <div class="flex min-h-screen relative bg-app-bg pt-16">
        <Sidebar hideDesktop={true} />
        <main class="flex-1 min-h-screen relative flex flex-col layout-transition ml-0">
          <div class="flex-1 max-w-4xl w-full mx-auto p-6 md:p-12 space-y-10 animate-fade-in">
            {props.children}
          </div>
        </main>
      </div>
    </>
  );
}
