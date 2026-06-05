export default function Footer() {
  return (
    <footer className="bg-gray-900 border-t border-gray-800 mt-12">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-400">
            <span className="text-red-500">▶</span>
            <span className="font-medium">xxxHubxxx</span>
          </div>
          <p className="text-sm text-gray-500">
            xxxHubxxx © {new Date().getFullYear()}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
