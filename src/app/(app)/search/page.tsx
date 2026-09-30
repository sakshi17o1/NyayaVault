"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type SearchResult = {
  id: string;
  title: string;
  type: string;
  caseNumber: string;
  snippet: string | null;
  status: string;
};

// Security Fix: Safely highlight text without using dangerouslySetInnerHTML (prevents Stored XSS)
function HighlightedText({ text, highlight }: { text: string; highlight: string }) {
  if (!highlight.trim()) return <span>{text}</span>;
  // Escape regex characters to prevent ReDoS
  const escapedHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escapedHighlight})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === highlight.toLowerCase() 
          ? <mark key={i} className="bg-yellow-200 text-slate-900 rounded px-1">{part}</mark> 
          : <span key={i}>{part}</span>
      )}
    </span>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const qParam = searchParams.get("q") || "";

  const [query, setQuery] = useState(qParam);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    setQuery(qParam);
    if (!qParam.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    let isMounted = true;
    async function doSearch() {
      setLoading(true);
      setHasSearched(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(qParam.trim())}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" }
        });
        const data = await res.json();
        if (isMounted) setResults(data.results || []);
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    doSearch();
    return () => { isMounted = false; };
  }, [qParam]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) {
      router.push("/search");
    } else {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy">Global Search</h1>
        <p className="text-slate-500 mt-1">Search through document titles, case numbers, and extracted OCR text.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <input
              type="text"
              placeholder="Enter keywords (e.g., FIR number, name, location)..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="flex-1 rounded-md border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
            />
            <Button type="submit" disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {hasSearched && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-500">
            {results.length} {results.length === 1 ? "Result" : "Results"} Found
          </h2>

          {results.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-white border rounded-lg">
              No documents matched your search query.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {results.map((doc) => (
                <Card key={doc.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-navy text-lg">{doc.title}</h3>
                        <div className="text-xs text-slate-500 mt-1 space-x-2">
                          <span className="font-medium text-slate-700">Case: {doc.caseNumber}</span>
                          <span>&bull;</span>
                          <span>Type: {doc.type}</span>
                        </div>
                      </div>
                      <Badge tone={doc.status === "APPROVED" ? "green" : "slate"}>
                        {doc.status}
                      </Badge>
                    </div>

                    {doc.snippet && (
                      <div className="mt-3 p-3 bg-slate-50 text-sm text-slate-600 font-mono rounded border border-slate-100 line-clamp-3">
                        <span className="font-semibold text-slate-400 select-none mr-2">OCR MATCH</span>
                        <HighlightedText text={doc.snippet || ""} highlight={qParam.trim()} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Loading search...</div>}>
      <SearchContent />
    </Suspense>
  );
}
