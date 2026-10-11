export function TutorCertificationLinks({ urls }: { urls: string[] }) {
  if (!urls.length) return <span className="text-zinc-500">Not provided</span>;
  return (
    <ul className="space-y-2">
      {urls.map((url, index) => (
        <li key={`${index}-${url}`}>
          {/^https?:\/\//i.test(url) ? (
            <a href={url} target="_blank" rel="noopener noreferrer" className="break-all underline">
              {url}
            </a>
          ) : (
            <span className="break-all">{url}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
