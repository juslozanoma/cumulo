export default function Logo() {
  return (
    <div className="logo">
      <img
        src="/icon.png"
        alt="Cumulo"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    </div>
  );
}