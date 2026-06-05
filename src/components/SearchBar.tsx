'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type SearchParams = {
  k?: string;
  sort?: string;
  durf?: string;
  datef?: string;
  quality?: string;
};

export default function SearchBar({ initial }: { initial?: SearchParams }) {
  const router = useRouter();
  const [keyword, setKeyword] = useState(initial?.k || '');
  const [sort, setSort] = useState(initial?.sort || 'relevance');
  const [durf, setDurf] = useState(initial?.durf || 'allduration');
  const [datef, setDatef] = useState(initial?.datef || 'all');
  const [quality, setQuality] = useState(initial?.quality || 'all');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (keyword) params.set('k', keyword);
    if (sort !== 'relevance') params.set('sort', sort);
    if (durf !== 'allduration') params.set('durf', durf);
    if (datef !== 'all') params.set('datef', datef);
    if (quality !== 'all') params.set('quality', quality);
    router.push(`/search?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Search videos..."
          className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
        />
        <button
          type="submit"
          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Search
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={sort}          onChange={(e) => setSort(e.target.value)} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-red-500">
          <option value="relevance">Relevance</option>
          <option value="uploaddate">Upload Date</option>
          <option value="rating">Rating</option>
          <option value="length">Length</option>
        </select>
        <select value={durf} onChange={(e) => setDurf(e.target.value)} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-red-500">
          <option value="allduration">All Durations</option>
          <option value="1-3min">1-3 min</option>
          <option value="3-10min">3-10 min</option>
          <option value="10-30min">10-30 min</option>
          <option value="30min+">30+ min</option>
        </select>
        <select value={datef} onChange={(e) => setDatef(e.target.value)} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-red-500">
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
        <select value={quality} onChange={(e) => setQuality(e.target.value)} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-red-500">
          <option value="all">All Quality</option>
          <option value="hd">HD</option>
          <option value="4k">4K</option>
        </select>
      </div>
    </form>
  );
}
