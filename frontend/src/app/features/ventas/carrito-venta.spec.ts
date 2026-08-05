import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CarritoVentaComponent } from './carrito-venta.component';

describe('CarritoVenta', () => {
  let component: CarritoVentaComponent;
  let fixture: ComponentFixture<CarritoVentaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CarritoVentaComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CarritoVentaComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
