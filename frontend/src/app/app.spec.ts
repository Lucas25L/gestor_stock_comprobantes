import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app';

describe('AppComponent', () => {
  
  // 1. Ejecutamos el parche ANTES de que corra cualquier test de este archivo
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},     // Funciones vacías para que PrimeNG 
        removeListener: () => {},  // no tire "is not a function"
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent], // O declarations si usás módulos tradicionales
    }).compileComponents();
  });

  // 2. Tus pruebas existentes se quedan abajo igual que siempre
  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});