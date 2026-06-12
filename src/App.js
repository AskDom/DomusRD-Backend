import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { PropertiesProvider } from "./context/PropertiesContext";
import { InboxProvider } from "./context/InboxContext";
import { ToastProvider } from "./context/ToastContext";
import { AnimatePresence } from "framer-motion";

import Home from "./pages/Home";
import Publish from "./pages/Publish";
import PropertyDetail from "./pages/PropertyDetail";
import SearchResults from "./pages/SearchResults";
import Profile from "./pages/Profile";
import Favorites from "./pages/Favorites";
import Inbox from "./pages/Inbox";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import PageTransition from "./components/PageTransition";

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Home /></PageTransition>} />
        <Route path="/search" element={<PageTransition><SearchResults /></PageTransition>} />
        <Route path="/property/:id" element={<PageTransition><PropertyDetail /></PageTransition>} />
        <Route path="/profile" element={<PageTransition><Profile /></PageTransition>} />
        <Route path="/favorites" element={<PageTransition><Favorites /></PageTransition>} />
        <Route path="/inbox" element={<PageTransition><Inbox /></PageTransition>} />
        <Route path="/publish" element={
          <PageTransition>
            <ProtectedRoute>
              <Publish />
            </ProtectedRoute>
          </PageTransition>
        } />
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PropertiesProvider>
          <InboxProvider>
            <ToastProvider>
              <Router>
                <AnimatedRoutes />
              </Router>
            </ToastProvider>
          </InboxProvider>
        </PropertiesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;