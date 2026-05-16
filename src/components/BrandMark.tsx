export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <div
      className="rounded-xl bg-accent text-white grid place-items-center font-extrabold"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      W
    </div>
  );
}
