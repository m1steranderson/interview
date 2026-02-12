import type { FC, PropsWithChildren } from "hono/jsx";
// @ts-expect-error — wrangler imports .css as text via rules config
import styles from "../generated.css";

interface LayoutProps {
  title?: string;
}

export const Layout: FC<PropsWithChildren<LayoutProps>> = ({
  title = "Task Manager",
  children,
}) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
      <style>{styles}</style>
    </head>
    <body class="bg-gray-50 text-gray-900 min-h-screen">
      <header class="bg-white border-b border-gray-200 px-6 py-4">
        <nav>
          <a href="/" class="text-lg font-semibold text-blue-600 hover:text-blue-800">
            Task Manager
          </a>
        </nav>
      </header>

      <main class="max-w-3xl mx-auto px-6 py-8">{children}</main>
    </body>
  </html>
);
