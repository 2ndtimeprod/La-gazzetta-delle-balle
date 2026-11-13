export default function Toast({ msg }: { msg?: string | null }) {
  return msg ? <p className="toast" role="alert">{msg}</p> : null;
}
