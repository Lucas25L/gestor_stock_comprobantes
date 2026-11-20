--
-- PostgreSQL database dump
--

\restrict 1LxF8vIsnlK4qCCxlk2OZI0RRX7gFEngPtrv0T2WYSGozX81xCtrAc8KtfqIXBe

-- Dumped from database version 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1)
-- Dumped by pg_dump version 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: django_migrations; Type: TABLE DATA; Schema: public; Owner: gestormini
--

INSERT INTO public.django_migrations (id, app, name, applied) VALUES (1, 'contenttypes', '0001_initial', '2026-11-20 20:22:39.252903-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (2, 'contenttypes', '0002_remove_content_type_name', '2026-11-20 20:22:39.272321-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (3, 'auth', '0001_initial', '2026-11-20 20:22:39.36485-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (4, 'auth', '0002_alter_permission_name_max_length', '2026-11-20 20:22:39.392616-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (5, 'auth', '0003_alter_user_email_max_length', '2026-11-20 20:22:39.438517-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (6, 'auth', '0004_alter_user_username_opts', '2026-11-20 20:22:39.464949-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (7, 'auth', '0005_alter_user_last_login_null', '2026-11-20 20:22:39.483882-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (8, 'auth', '0006_require_contenttypes_0002', '2026-11-20 20:22:39.489021-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (9, 'auth', '0007_alter_validators_add_error_messages', '2026-11-20 20:22:39.498698-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (10, 'auth', '0008_alter_user_username_max_length', '2026-11-20 20:22:39.521853-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (11, 'auth', '0009_alter_user_last_name_max_length', '2026-11-20 20:22:39.540475-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (12, 'auth', '0010_alter_group_name_max_length', '2026-11-20 20:22:39.561816-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (13, 'auth', '0011_update_proxy_permissions', '2026-11-20 20:22:39.578462-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (14, 'auth', '0012_alter_user_first_name_max_length', '2026-11-20 20:22:39.628511-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (15, 'usuarios', '0001_initial', '2026-11-20 20:22:39.707363-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (16, 'admin', '0001_initial', '2026-11-20 20:22:39.734896-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (17, 'admin', '0002_logentry_remove_auto_add', '2026-11-20 20:22:39.764391-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (18, 'admin', '0003_logentry_add_action_flag_choices', '2026-11-20 20:22:39.794892-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (19, 'auditoria', '0001_initial', '2026-11-20 20:22:39.852803-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (20, 'auditoria', '0002_proteger_registros', '2026-11-20 20:22:39.914211-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (21, 'categorias', '0001_initial', '2026-11-20 20:22:39.926771-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (22, 'productos', '0001_initial', '2026-11-20 20:22:39.945853-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (23, 'ventas', '0001_initial', '2026-11-20 20:22:40.017521-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (24, 'unidades', '0001_initial', '2026-11-20 20:22:40.028245-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (25, 'unidades', '0002_cargar_unidades_iniciales', '2026-11-20 20:22:40.095124-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (26, 'unidades', '0003_permite_decimales', '2026-11-20 20:22:40.155991-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (27, 'productos', '0002_producto_unidad', '2026-11-20 20:22:40.201412-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (28, 'productos', '0003_asignar_unidad_inicial', '2026-11-20 20:22:40.331217-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (29, 'productos', '0004_unidad_obligatoria_y_cantidades_decimales', '2026-11-20 20:22:40.573134-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (30, 'ventas', '0002_cantidades_decimales', '2026-11-20 20:22:40.66757-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (31, 'mediospago', '0001_initial', '2026-11-20 20:22:40.676989-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (32, 'mediospago', '0002_cargar_medios_iniciales', '2026-11-20 20:22:40.739813-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (33, 'ventas', '0003_venta_medio_pago', '2026-11-20 20:22:40.7839-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (34, 'ventas', '0004_asignar_medio_pago_inicial', '2026-11-20 20:22:40.879742-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (35, 'ventas', '0005_medio_pago_obligatorio', '2026-11-20 20:22:40.944587-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (36, 'ventas', '0006_venta_datos_de_anulacion', '2026-11-20 20:22:40.999328-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (37, 'ventas', '0007_completar_ventas_ya_anuladas', '2026-11-20 20:22:41.037709-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (38, 'ventas', '0008_venta_anulada_con_datos', '2026-11-20 20:22:41.057331-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (39, 'comprobantes', '0001_initial', '2026-11-20 20:22:41.065557-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (40, 'comprobantes', '0002_initial', '2026-11-20 20:22:41.089758-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (41, 'comprobantes', '0003_contador_y_contenido', '2026-11-20 20:22:41.154915-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (42, 'comprobantes', '0004_completar_comprobantes_existentes', '2026-11-20 20:22:41.244174-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (43, 'comprobantes', '0005_comprobante_estado_valido', '2026-11-20 20:22:41.257068-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (44, 'sessions', '0001_initial', '2026-11-20 20:22:41.267899-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (45, 'stock', '0001_initial', '2026-11-20 20:22:41.310632-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (46, 'token_blacklist', '0001_initial', '2026-11-20 20:22:41.384945-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (47, 'token_blacklist', '0002_outstandingtoken_jti_hex', '2026-11-20 20:22:41.410591-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (48, 'token_blacklist', '0003_auto_20171017_2007', '2026-11-20 20:22:41.445743-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (49, 'token_blacklist', '0004_auto_20171017_2013', '2026-11-20 20:22:41.47246-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (50, 'token_blacklist', '0005_remove_outstandingtoken_jti', '2026-11-20 20:22:41.497589-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (51, 'token_blacklist', '0006_auto_20171017_2113', '2026-11-20 20:22:41.527397-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (52, 'token_blacklist', '0007_auto_20171017_2214', '2026-11-20 20:22:41.597745-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (53, 'token_blacklist', '0008_migrate_to_bigautofield', '2026-11-20 20:22:41.714145-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (54, 'token_blacklist', '0010_fix_migrate_to_bigautofield', '2026-11-20 20:22:41.748806-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (55, 'token_blacklist', '0011_linearizes_history', '2026-11-20 20:22:41.751568-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (56, 'token_blacklist', '0012_alter_outstandingtoken_user', '2026-11-20 20:22:41.776368-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (57, 'token_blacklist', '0013_alter_blacklistedtoken_options_and_more', '2026-11-20 20:22:41.804344-03');
INSERT INTO public.django_migrations (id, app, name, applied) VALUES (58, 'usuarios', '0002_cargar_roles', '2026-11-20 20:22:41.846896-03');


--
-- Data for Name: mediospago_mediopago; Type: TABLE DATA; Schema: public; Owner: gestormini
--

INSERT INTO public.mediospago_mediopago (id, nombre, descripcion, activo) VALUES (1, 'Efectivo', 'Pago en efectivo', true);
INSERT INTO public.mediospago_mediopago (id, nombre, descripcion, activo) VALUES (2, 'Tarjeta de débito', '', true);
INSERT INTO public.mediospago_mediopago (id, nombre, descripcion, activo) VALUES (3, 'Tarjeta de crédito', '', true);
INSERT INTO public.mediospago_mediopago (id, nombre, descripcion, activo) VALUES (4, 'Transferencia', 'Transferencia bancaria', true);
INSERT INTO public.mediospago_mediopago (id, nombre, descripcion, activo) VALUES (5, 'Billetera virtual', 'Pago con billetera virtual o QR', true);


--
-- Data for Name: unidades_unidadmedida; Type: TABLE DATA; Schema: public; Owner: gestormini
--

INSERT INTO public.unidades_unidadmedida (id, nombre, abreviatura, activo, permite_decimales) VALUES (1, 'Unidad', 'u', true, false);
INSERT INTO public.unidades_unidadmedida (id, nombre, abreviatura, activo, permite_decimales) VALUES (2, 'Kilogramo', 'kg', true, true);
INSERT INTO public.unidades_unidadmedida (id, nombre, abreviatura, activo, permite_decimales) VALUES (3, 'Litro', 'l', true, true);


--
-- Data for Name: usuarios_rol; Type: TABLE DATA; Schema: public; Owner: gestormini
--

INSERT INTO public.usuarios_rol (id, nombre, descripcion, activo) VALUES (1, 'Administrador', 'Gestiona usuarios, catálogo, stock, ventas, indicadores y auditoría.', true);
INSERT INTO public.usuarios_rol (id, nombre, descripcion, activo) VALUES (2, 'Cajero', 'Registra ventas, emite comprobantes y anula ventas.', true);
INSERT INTO public.usuarios_rol (id, nombre, descripcion, activo) VALUES (3, 'Repositor', 'Registra ingresos y ajustes de stock.', true);


--
-- Name: django_migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gestormini
--

SELECT pg_catalog.setval('public.django_migrations_id_seq', 58, true);


--
-- Name: mediospago_mediopago_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gestormini
--

SELECT pg_catalog.setval('public.mediospago_mediopago_id_seq', 5, true);


--
-- Name: unidades_unidadmedida_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gestormini
--

SELECT pg_catalog.setval('public.unidades_unidadmedida_id_seq', 3, true);


--
-- Name: usuarios_rol_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gestormini
--

SELECT pg_catalog.setval('public.usuarios_rol_id_seq', 3, true);


--
-- PostgreSQL database dump complete
--

\unrestrict 1LxF8vIsnlK4qCCxlk2OZI0RRX7gFEngPtrv0T2WYSGozX81xCtrAc8KtfqIXBe

