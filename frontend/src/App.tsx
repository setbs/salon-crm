import { CalendarDays, Check, Clock, Mail, MapPin, Phone, Scissors, UserRound } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createAppointment,
  fetchAvailability,
  fetchEmployees,
  fetchServices,
  type Employee,
  type Service,
  type Slot
} from "./api";

const money = new Intl.NumberFormat("uk-UA", {
  style: "currency",
  currency: "UAH",
  maximumFractionDigits: 0
});

const serviceCopy: Record<string, { name: string; description: string }> = {
  "Women's haircut": {
    name: "Жіноча стрижка",
    description: "консультація / миття / укладка"
  },
  "Classic manicure": {
    name: "Класичний манікюр",
    description: "форма / кутикула / покриття"
  },
  "Hair coloring": {
    name: "Фарбування волосся",
    description: "консультація / повне фарбування"
  }
};

const today = new Date().toISOString().slice(0, 10);

export function App() {
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [client, setClient] = useState({ firstName: "", lastName: "", phone: "", email: "" });
  const [clientComment, setClientComment] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "success">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchServices()
      .then((data) => {
        setServices(data);
        setStatus("idle");
      })
      .catch((loadError: Error) => {
        setError(loadError.message);
        setStatus("idle");
      });
  }, []);

  useEffect(() => {
    setSelectedEmployeeId("");
    setSelectedSlot(null);
    setSlots([]);

    fetchEmployees(selectedServiceIds)
      .then(setEmployees)
      .catch((loadError: Error) => setError(loadError.message));
  }, [selectedServiceIds]);

  useEffect(() => {
    setSelectedSlot(null);

    if (!selectedEmployeeId || selectedServiceIds.length === 0 || !selectedDate) {
      setSlots([]);
      return;
    }

    fetchAvailability(selectedEmployeeId, selectedServiceIds, selectedDate)
      .then(setSlots)
      .catch((loadError: Error) => setError(loadError.message));
  }, [selectedEmployeeId, selectedServiceIds, selectedDate]);

  const selectedServices = useMemo(
    () => services.filter((service) => selectedServiceIds.includes(service.id)),
    [services, selectedServiceIds]
  );

  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId);

  const total = selectedServices.reduce(
    (summary, service) => ({
      duration: summary.duration + service.durationMinutes,
      price: summary.price + service.price
    }),
    { duration: 0, price: 0 }
  );

  function toggleService(id: string) {
    setError("");
    setSelectedServiceIds((current) =>
      current.includes(id) ? current.filter((serviceId) => serviceId !== id) : [...current, id]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!selectedSlot) {
      setError("Оберіть доступний час.");
      return;
    }

    setStatus("saving");

    try {
      await createAppointment({
        employeeId: selectedEmployeeId,
        serviceIds: selectedServiceIds,
        startTime: selectedSlot.startTime,
        client,
        clientComment: clientComment || undefined
      });
      setStatus("success");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не вдалося створити запис.");
      setStatus("idle");
    }
  }

  if (status === "success") {
    return (
      <main className="success-screen">
        <section className="success-panel document-frame">
          <div className="sl-logo compact" aria-hidden="true">
            <span>S</span>
            <span>L</span>
          </div>
          <div className="success-icon">
            <Check aria-hidden="true" size={30} />
          </div>
          <p className="eyebrow">SL Color Studio</p>
          <h1>Запис підтверджено</h1>
          <p>
            {client.firstName}, ваш візит зарезервовано на {selectedSlot?.label}, {selectedDate}.
          </p>
          <button type="button" onClick={() => window.location.reload()}>
            Новий запис
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="booking-document document-frame">
        <aside className="brand-column">
          <header className="brand-card">
            <div className="sl-logo" aria-hidden="true">
              <span>S</span>
              <span>L</span>
            </div>
            <div>
              <p className="studio-name">Color Studio</p>
              <div className="brand-rule" />
            </div>
          </header>

          <section className="contact-panel">
            <div className="contact-line">
              <Phone aria-hidden="true" size={18} />
              <span>+38 (050) 23 03 408</span>
            </div>
            <div className="contact-line">
              <MapPin aria-hidden="true" size={18} />
              <span>м. Броди, вул. Стуса 2</span>
            </div>
            <div className="contact-line">
              <Mail aria-hidden="true" size={18} />
              <span>sl.color.studio@example.com</span>
            </div>
          </section>

          <section className="price-list">
            <div className="section-heading">
              <h1>Price List</h1>
              <span>Запис онлайн</span>
            </div>

            <div className="price-box">
              <div className="price-title">
                <Scissors aria-hidden="true" size={20} />
                <h2>Послуги</h2>
              </div>

              <div className="service-list">
                {status === "loading" ? <p className="empty-state">Завантаження послуг...</p> : null}
                {services.map((service) => {
                  const selected = selectedServiceIds.includes(service.id);
                  const copy = serviceCopy[service.name];

                  return (
                    <button
                      className={selected ? "service-row selected" : "service-row"}
                      key={service.id}
                      onClick={() => toggleService(service.id)}
                      type="button"
                    >
                      <span className="service-text">
                        <strong>{copy?.name ?? service.name}</strong>
                        <small>{copy?.description ?? service.description ?? "індивідуальна консультація"}</small>
                      </span>
                      <span className="service-meta">
                        <strong>{money.format(service.price)}</strong>
                        <small>{service.durationMinutes} хв</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </aside>

        <section className="form-column">
          <div className="form-heading">
            <p className="eyebrow">Онлайн бронювання</p>
            <h2>Оберіть майстра та час</h2>
          </div>

          {error ? <div className="alert">{error}</div> : null}

          <form onSubmit={handleSubmit} className="booking-form">
            <section className="form-section">
              <label>
                <span className="field-label">
                  <UserRound aria-hidden="true" size={16} />
                  Майстер
                </span>
                <select
                  value={selectedEmployeeId}
                  onChange={(event) => setSelectedEmployeeId(event.target.value)}
                  disabled={selectedServiceIds.length === 0}
                  required
                >
                  <option value="">Оберіть майстра</option>
                  {employees.map((employee) => (
                    <option value={employee.id} key={employee.id}>
                      {employee.firstName} {employee.lastName} · {employee.specialization}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="field-label">
                  <CalendarDays aria-hidden="true" size={16} />
                  Дата
                </span>
                <input
                  type="date"
                  min={today}
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  required
                />
              </label>
            </section>

            <section className="form-section">
              <div className="field-label">
                <Clock aria-hidden="true" size={16} />
                Доступний час
              </div>
              <div className="slot-grid">
                {slots.map((slot) => (
                  <button
                    className={selectedSlot?.startTime === slot.startTime ? "slot selected" : "slot"}
                    key={slot.startTime}
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {slot.label}
                  </button>
                ))}
                {selectedEmployeeId && slots.length === 0 ? <p className="empty-state">На цю дату вільних годин немає.</p> : null}
                {!selectedEmployeeId ? <p className="empty-state">Спочатку оберіть послугу та майстра.</p> : null}
              </div>
            </section>

            <section className="form-section client-grid">
              <label>
                <span>Ім'я</span>
                <input
                  value={client.firstName}
                  onChange={(event) => setClient({ ...client, firstName: event.target.value })}
                  required
                />
              </label>
              <label>
                <span>Прізвище</span>
                <input
                  value={client.lastName}
                  onChange={(event) => setClient({ ...client, lastName: event.target.value })}
                  required
                />
              </label>
              <label>
                <span>Телефон</span>
                <input
                  value={client.phone}
                  onChange={(event) => setClient({ ...client, phone: event.target.value })}
                  required
                />
              </label>
              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={client.email}
                  onChange={(event) => setClient({ ...client, email: event.target.value })}
                />
              </label>
            </section>

            <label className="full-width">
              <span>Коментар</span>
              <textarea value={clientComment} onChange={(event) => setClientComment(event.target.value)} rows={3} />
            </label>

            <footer className="booking-footer">
              <div className="summary">
                <span>{selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : "Майстра не обрано"}</span>
                <strong>{selectedServices.length > 0 ? money.format(total.price) : "Оберіть послуги"}</strong>
                <small>{total.duration > 0 ? `${total.duration} хв загалом` : "Прайс зліва активний"}</small>
              </div>
              <button
                className="primary-button"
                type="submit"
                disabled={
                  status === "loading" ||
                  status === "saving" ||
                  selectedServiceIds.length === 0 ||
                  !selectedEmployeeId ||
                  !selectedSlot
                }
              >
                {status === "saving" ? "Бронювання..." : "Підтвердити запис"}
              </button>
            </footer>
          </form>
        </section>
      </section>
    </main>
  );
}
