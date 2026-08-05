import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VisorComprobanteComponent } from './visor-comprobante.component';

describe('VisorComprobante', () => {
  let component: VisorComprobanteComponent;
  let fixture: ComponentFixture<VisorComprobanteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VisorComprobanteComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(VisorComprobanteComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
