UPDATE public.usuarios_base
SET auth_user_id = NULL,
    email_validado = false,
    status = 'convite_enviado'
WHERE id = 'f9705c8b-a6ea-4c9c-829f-8ed371a08fe2'
  AND tenant_id = '16ed4748-6f54-44d2-a2ad-7c621ac7e905'
  AND auth_user_id = '186e4fba-ccb5-4886-9dc1-d233016a0553';