import Header from './components/Header';
import Footer from './components/Footer';
import Home from './Pages/Home';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300 flex flex-col">
      <Header />
      
      <main className="flex-1">
        <Home />
      </main>
      
      <Footer />
    </div>
  );
}

export default App
