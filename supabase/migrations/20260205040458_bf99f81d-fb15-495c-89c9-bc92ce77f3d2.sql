-- Migração Parte 1: Adicionar novo valor ao enum (separado do uso)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'superadmin';