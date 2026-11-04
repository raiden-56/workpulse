import { RouterProvider } from 'react-router-dom';
import { AppProviders } from './app/providers/AppProviders';
import { SessionBootstrap } from './app/providers/SessionBootstrap';
import { router } from './app/routes/router';
import { store } from './app/store/store';

export default function App() {
  return (
    <AppProviders store={store}>
      <SessionBootstrap />
      <RouterProvider router={router} />
    </AppProviders>
  );
}
