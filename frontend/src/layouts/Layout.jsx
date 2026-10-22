import { Outlet } from 'react-router-dom';
import Footer from '../components/Footer';
import { ToyProvider } from '../components/fun/ToyContext';

const Layout = () => {
  return (
    <ToyProvider>
      <Outlet />
      <Footer />
    </ToyProvider>
  );
};

export default Layout;
