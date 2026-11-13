export default function Waiting({ children }: { children: React.ReactNode }) {
  return <p className="waiting"><span className="dots"><i /><i /><i /></span>{children}</p>;
}
