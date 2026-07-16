export default function ApiAuthRow({
  apiKey,
  setApiKey,
  onAuthenticate,
  authLoading,
  authSuccess,
  authError,
  hideRow,
  disabled,
}) {
  return (
    <>
      {!hideRow && (
        <div className="api-row" id="apiRow">
          <div className="api-setup" id="apiSetup">
            <input
              type="password"
              id="apiKey"
              placeholder="Ingresa tu código de acceso"
              value={apiKey}
              disabled={disabled}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onAuthenticate();
              }}
            />
          </div>
          <button className="btn-auth" id="btnAuth" onClick={onAuthenticate} disabled={disabled} aria-label="Autenticar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      )}

      {authLoading && (
        <div className="auth-loading show" id="authLoading">
          <div className="spinner"></div>
          Realizando autenticacion...
        </div>
      )}

      {authSuccess && !hideRow === false && authSuccess && (
        <div className="api-success show" id="apiSuccess">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Autenticacion correcta
        </div>
      )}

      {authError && (
        <div className="api-error show" id="apiError">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          Acceso denegado
        </div>
      )}
    </>
  );
}