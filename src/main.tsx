import { render } from 'preact';
import { App } from './ui/app';
import { Overlay } from './ui/overlay';
import './ui/styles.css';
import './ui/overlay.css';

const root = document.getElementById('app');
const isOverlay = new URLSearchParams(window.location.search).get('view') === 'overlay';

if (root) {
  if (isOverlay) {
    document.documentElement.classList.add('overlay-view');
  }
  render(isOverlay ? <Overlay /> : <App />, root);
}
