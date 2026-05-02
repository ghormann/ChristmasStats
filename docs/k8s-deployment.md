# Kubernetes Deployment Guide

Namespace: `gjh-christmas`

The app requires two Secrets: one for PostgreSQL credentials (injected as env vars) and one for the greglights config (mounted as a file).

Migrations run automatically when the pod starts — no manual init step is needed.

---

## 1. PostgreSQL Credentials Secret

Create this Secret with your actual connection details:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: postgres-credentials
  namespace: gjh-christmas
type: Opaque
stringData:
  PGHOST: "your-postgres-host"
  PGPORT: "5432"
  PGUSER: "christmas_user"
  PGPASSWORD: "your-password"
  PGDATABASE: "christmas_stats_prod"
```

Apply:
```bash
kubectl apply -f postgres-credentials-secret.yaml
```

---

## 2. greglights Config Secret

The app config is stored as a Secret and mounted as a file at `/app/greglights_config.json` inside the container.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: greglights-config
  namespace: gjh-christmas
type: Opaque
stringData:
  config.json: |
    {
      "username": "mqtt-user",
      "password": "mqtt-password",
      "host": "mqtt.example.com",
      "port": 8883,
      "ca_file": "/etc/certs/ca.crt",
      "send_enabled": true,
      "pricePerKWH": 0.12
    }
```

Apply:
```bash
kubectl apply -f greglights-config-secret.yaml
```

---

## 3. App Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: christmas-stats
  namespace: gjh-christmas
spec:
  replicas: 1
  selector:
    matchLabels:
      app: christmas-stats
  template:
    metadata:
      labels:
        app: christmas-stats
    spec:
      containers:
        - name: app
          image: your-registry/christmas-stats-app:latest
          envFrom:
            - secretRef:
                name: postgres-credentials
          volumeMounts:
            - name: greglights-config
              mountPath: /app/greglights_config.json
              subPath: config.json
              readOnly: true
      volumes:
        - name: greglights-config
          secret:
            secretName: greglights-config
```

Apply:
```bash
kubectl apply -f deployment.yaml
```

---

## 4. Verify startup

Check that migrations ran and MQTT connected:

```bash
kubectl logs -n gjh-christmas deployment/christmas-stats
```

Expected log lines:
```
Connecting to PostgreSQL...
Connected to PostgreSQL
Running migrations...
Starting MQTT
MQTT Connect
```

---

## Notes

- The PostgreSQL database (`PGDATABASE`) must already exist on the server. The app creates tables and hypertables via migrations but does not create the database itself.
- TimescaleDB extension must be installed in the target database, or the migration user must have `CREATE EXTENSION` privileges.
- To use the dev database, set `PGDATABASE: "christmas_stats_dev"` in the `postgres-credentials` Secret.
