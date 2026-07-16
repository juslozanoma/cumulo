export default function LoadingBox({ show }) {
  if (!show) return null;
  return (
    <div className="loading-box show" id="loadingBox">
      <div className="spinner"></div>
      Buscando...
    </div>
  );
}