import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import './styles/app.css';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="startup"><h1>화면을 열지 못했습니다</h1><p>저장 자료는 삭제하지 않았습니다. 다시 접속해 주세요.</p><button onClick={() => window.location.reload()}>다시 접속</button></main>;
    return this.props.children;
  }
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>);
