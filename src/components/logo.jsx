export default function Logo() {
  return (
    <div className="logo">
      <img
        src={import.meta.env.BASE_URL + 'icon.png'}
        alt="Cumulo"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    </div>
  );
}