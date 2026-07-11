class FechasTemporal {
    constructor() {
        this.TZ = "America/Argentina/Buenos_Aires";
        if(typeof module != "undefined") this.Temporal = require("temporal-polyfill").Temporal;
        else this.Temporal = Temporal;
    }

    // =========================
    // 🔹 PARSEO
    // =========================

    toDate(val) {
        if (!val) return this.Temporal.Now.plainDateISO(this.TZ);

        // STRING
        if (typeof val === "string") {
            val = val.trim();

            // ISO con zona (Z o offset)
            if (typeof val === "string" && (val.endsWith("Z") || val.includes("+"))) {
                return this.Temporal.Instant
                    .from(val)
                    .toZonedDateTimeISO(this.TZ)
                    .toPlainDate();
            }

            // formato ARG → YYYY-MM-DD
            if (val.includes("/")) {
                let [d, m, y] = val.split("/");
                return this.Temporal.PlainDate.from(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
            }

            // YYYY-MM-DD
            if (!val.includes("T")) {
                return this.Temporal.PlainDate.from(val);
            }

            // YYYY-MM-DDTHH:mm:ss
            return this.Temporal.PlainDateTime.from(val);
        }

        // DATE (JS)
        if (val instanceof Date) {
            return this.Temporal.Instant
                .fromEpochMilliseconds(val.getTime())
                .toZonedDateTimeISO(this.TZ)
                .toPlainDate();
        }

        // Temporal ya válido
        if (
            val instanceof this.Temporal.PlainDate ||
            val instanceof this.Temporal.PlainDateTime
        ) {
            return val;
        }

        throw new Error("Formato de fecha no soportado");
    }

    // =========================
    // 🔹 FORMATOS
    // =========================

    toString(val, format = "usa") {
        let t = this.toDate(val);

        let year = t.year;
        let month = t.month.toString().padStart(2, "0");
        let day = t.day.toString().padStart(2, "0");

        if (format === "arg") return `${day}/${month}/${year}`;
        return `${year}-${month}-${day}`; // default USA
    }

    toDateTimeString(val) {
        let t = this.toDate(val);

        if (t instanceof this.Temporal.PlainDate) {
            return `${this.toString(t)}T00:00:00`;
        }

        let hh = t.hour.toString().padStart(2, "0");
        let mm = t.minute.toString().padStart(2, "0");
        let ss = t.second.toString().padStart(2, "0");

        return `${this.toString(t)}T${hh}:${mm}:${ss}`;
    }

    // =========================
    // 🔹 OPERACIONES
    // =========================

    add(val, { days = 0, months = 0, years = 0 }) {
        let t = this.toDate(val);
        return t.add({ days, months, years });
    }

    diffDays(f1, f2) {
        let d1 = this.toDate(f1);
        let d2 = this.toDate(f2);
        return d2.since(d1).days;
    }

    daysInMonth(val) {
        let t = this.toDate(val);
        if (t instanceof this.Temporal.PlainDateTime) {
            t = t.toPlainDate();
        }
        return t.daysInMonth;
    }

    weekNumber(val) {
        let t = this.toDate(val);
        if (t instanceof this.Temporal.PlainDateTime) {
            t = t.toPlainDate();
        }
        return t.weekOfYear;
    }

    // =========================
    // 🔹 MONGO
    // =========================

    toMongoDate(val) {
        let t = this.toDate(val);

        return new Date(
            t.year,
            t.month - 1,
            t.day,
            0, 0, 0, 0
        );
    }

    toMongoDateTime(val) {
        let t = this.toDate(val);

        if (t instanceof this.Temporal.PlainDate) {
            return new Date(t.year, t.month - 1, t.day);
        }

        return new Date(
            t.year,
            t.month - 1,
            t.day,
            t.hour,
            t.minute,
            t.second,
            0
        );
    }

    // =========================
    // 🔹 UTILS
    // =========================

    now() {
        return this.Temporal.Now.plainDateISO(this.TZ);
    }

    nowDateTime() {
        return this.Temporal.Now.zonedDateTimeISO(this.TZ).toPlainDateTime();
    }
}

if (typeof module != "undefined") {
    module.exports = {
        FechasTemporal: new FechasTemporal(),
        Temporal: this.Temporal
    };
}