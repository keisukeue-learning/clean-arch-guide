const CATEGORIES = [
  {
    id: "entities",
    title: "Entities (Domain Layer)",
    desc: "Core business rules — the heart of the system",
    icon: "&#x2764;",
    color: "#e74c3c",
    items: [
      {
        title: "Entity",
        layer: "entities",
        tags: ["domain", "core", "business-rule"],
        desc: "Objects that encapsulate enterprise-wide business rules. They are the least likely to change when something external changes.",
        example: `// Entity — pure business logic, no framework dependency
class User {
  constructor(
    public readonly id: string,
    public name: string,
    public email: string
  ) {}

  isValidEmail(): boolean {
    return /^[^@]+@[^@]+$/.test(this.email);
  }
}`,
        relations: ["Used by Use Cases", "Never depends on outer layers"]
      },
      {
        title: "Value Object",
        layer: "entities",
        tags: ["domain", "immutable", "business-rule"],
        desc: "Immutable objects defined by their attributes, not identity. Two value objects with the same data are equal.",
        example: `// Value Object — immutable, compared by value
class Money {
  constructor(
    public readonly amount: number,
    public readonly currency: string
  ) {}

  add(other: Money): Money {
    if (this.currency !== other.currency)
      throw new Error("Currency mismatch");
    return new Money(this.amount + other.amount, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount
        && this.currency === other.currency;
  }
}`,
        relations: ["Part of Entities", "Used inside Aggregates"]
      },
      {
        title: "Domain Service",
        layer: "entities",
        tags: ["domain", "business-rule", "stateless"],
        desc: "Stateless operations that don't naturally belong to a single entity. Contains domain logic that spans multiple entities.",
        example: `// Domain Service — logic spanning multiple entities
class TransferService {
  execute(from: Account, to: Account, amount: Money): void {
    if (!from.canWithdraw(amount))
      throw new Error("Insufficient funds");
    from.withdraw(amount);
    to.deposit(amount);
  }
}`,
        relations: ["Operates on Entities", "Called by Use Cases"]
      },
      {
        title: "Repository Interface",
        layer: "entities",
        tags: ["domain", "abstraction", "dependency-inversion"],
        desc: "An INTERFACE (not implementation) defined in the domain layer. The actual DB logic lives in Frameworks layer. This is the key to Dependency Inversion.",
        example: `// Repository INTERFACE in domain layer
// Implementation lives in frameworks layer
interface UserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
  delete(id: string): Promise<void>;
}`,
        relations: ["Implemented by Frameworks layer", "Used by Use Cases via DI"]
      }
    ]
  },
  {
    id: "usecases",
    title: "Use Cases (Application Layer)",
    desc: "Application-specific business rules — orchestration logic",
    icon: "&#x2699;",
    color: "#f39c12",
    items: [
      {
        title: "Use Case / Interactor",
        layer: "usecases",
        tags: ["application", "orchestration", "single-responsibility"],
        desc: "Each use case represents ONE action the system can perform. It orchestrates entities and calls repository interfaces. Has no knowledge of UI or DB.",
        example: `// Use Case — one action, receives dependencies via constructor
class CreateOrderUseCase {
  constructor(
    private orderRepo: OrderRepository,   // interface
    private paymentGateway: PaymentGateway // interface
  ) {}

  async execute(input: CreateOrderInput): Promise<Order> {
    const order = new Order(input.userId, input.items);
    order.calculateTotal();

    await this.paymentGateway.charge(order.total);
    await this.orderRepo.save(order);

    return order;
  }
}`,
        relations: ["Depends on Entity interfaces", "Called by Adapters (Controllers)"]
      },
      {
        title: "Input/Output DTOs",
        layer: "usecases",
        tags: ["application", "data-transfer", "boundary"],
        desc: "Simple data structures that cross the use case boundary. Input DTOs carry request data in; Output DTOs carry results out. No business logic inside.",
        example: `// Input DTO — what the use case needs
interface CreateOrderInput {
  userId: string;
  items: { productId: string; qty: number }[];
}

// Output DTO — what the use case returns
interface CreateOrderOutput {
  orderId: string;
  total: number;
  status: "pending" | "confirmed";
}`,
        relations: ["Passed into Use Cases", "Returned to Adapters"]
      },
      {
        title: "Application Service",
        layer: "usecases",
        tags: ["application", "coordination", "transaction"],
        desc: "Coordinates multiple use cases or adds cross-cutting concerns like transactions. Thinner than use cases — delegates, doesn't contain logic.",
        example: `// Application Service — coordinates, doesn't contain logic
class OrderApplicationService {
  constructor(
    private createOrder: CreateOrderUseCase,
    private sendNotification: SendNotificationUseCase,
    private txManager: TransactionManager
  ) {}

  async placeOrder(input: CreateOrderInput) {
    return this.txManager.run(async () => {
      const order = await this.createOrder.execute(input);
      await this.sendNotification.execute({
        userId: input.userId,
        message: \`Order \${order.orderId} placed\`
      });
      return order;
    });
  }
}`,
        relations: ["Wraps Use Cases", "Adds transactions/logging"]
      }
    ]
  },
  {
    id: "adapters",
    title: "Interface Adapters",
    desc: "Convert data between use cases and external formats",
    icon: "&#x1F504;",
    color: "#2ecc71",
    items: [
      {
        title: "Controller",
        layer: "adapters",
        tags: ["adapter", "input", "http"],
        desc: "Receives external input (HTTP, CLI, etc.), converts it into use case input format, calls the use case, and converts the output for the external world.",
        example: `// Controller — translates HTTP → Use Case → HTTP
class OrderController {
  constructor(private createOrder: CreateOrderUseCase) {}

  async handlePost(req: Request, res: Response) {
    // Convert HTTP request → Use Case Input
    const input: CreateOrderInput = {
      userId: req.body.userId,
      items: req.body.items
    };

    const result = await this.createOrder.execute(input);

    // Convert Use Case Output → HTTP response
    res.status(201).json({
      id: result.orderId,
      total: result.total
    });
  }
}`,
        relations: ["Calls Use Cases", "Depends on web framework (loosely)"]
      },
      {
        title: "Presenter / ViewModel",
        layer: "adapters",
        tags: ["adapter", "output", "ui"],
        desc: "Formats use case output into a shape suitable for the UI. Keeps formatting logic out of both the use case and the view.",
        example: `// Presenter — formats output for display
class OrderPresenter {
  present(output: CreateOrderOutput): OrderViewModel {
    return {
      orderId: output.orderId,
      displayTotal: \`$\${output.total.toFixed(2)}\`,
      statusLabel: output.status === "confirmed"
        ? "Order Confirmed"
        : "Processing...",
      statusColor: output.status === "confirmed"
        ? "green" : "orange"
    };
  }
}`,
        relations: ["Receives Use Case output", "Feeds the View"]
      },
      {
        title: "Gateway / Anti-Corruption Layer",
        layer: "adapters",
        tags: ["adapter", "external-api", "translation"],
        desc: "Translates between your domain model and an external system's model. Protects your domain from external changes.",
        example: `// Gateway — shields domain from external API shape
class StripePaymentGateway implements PaymentGateway {
  constructor(private stripeClient: Stripe) {}

  async charge(amount: Money): Promise<PaymentResult> {
    // Translate domain → Stripe format
    const result = await this.stripeClient.charges.create({
      amount: amount.amount * 100, // Stripe uses cents
      currency: amount.currency
    });

    // Translate Stripe → domain format
    return {
      success: result.status === "succeeded",
      transactionId: result.id
    };
  }
}`,
        relations: ["Implements domain interfaces", "Wraps external SDKs"]
      }
    ]
  },
  {
    id: "frameworks",
    title: "Frameworks & Drivers",
    desc: "Database, UI framework, external tools — the outermost ring",
    icon: "&#x1F527;",
    color: "#3498db",
    items: [
      {
        title: "Repository Implementation",
        layer: "frameworks",
        tags: ["infrastructure", "database", "dependency-inversion"],
        desc: "The CONCRETE implementation of repository interfaces defined in the domain. This is where actual SQL/ORM calls live.",
        example: `// Concrete repo — implements domain interface
class PostgresUserRepository implements UserRepository {
  constructor(private db: Pool) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.db.query(
      "SELECT * FROM users WHERE id = $1", [id]
    );
    if (!row.rows[0]) return null;
    // Map DB row → Domain Entity
    return new User(row.rows[0].id, row.rows[0].name, row.rows[0].email);
  }

  async save(user: User): Promise<void> {
    await this.db.query(
      "INSERT INTO users (id, name, email) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name=$2, email=$3",
      [user.id, user.name, user.email]
    );
  }
}`,
        relations: ["Implements domain Repository interface", "Injected into Use Cases"]
      },
      {
        title: "Web Framework Setup",
        layer: "frameworks",
        tags: ["infrastructure", "http", "framework"],
        desc: "Express/Fastify/Hono route definitions, middleware setup, etc. This layer is a plugin — swappable without touching business logic.",
        example: `// Framework setup — thin glue, no business logic
const app = express();

// Routes just wire HTTP to controllers
app.post("/orders", (req, res) =>
  orderController.handlePost(req, res)
);

app.get("/orders/:id", (req, res) =>
  orderController.handleGet(req, res)
);`,
        relations: ["Calls Controllers (Adapters)", "Completely replaceable"]
      },
      {
        title: "External Service Client",
        layer: "frameworks",
        tags: ["infrastructure", "external", "sdk"],
        desc: "Raw SDK clients for external services (Stripe, AWS, SendGrid). Never used directly by use cases — always wrapped by a Gateway in the adapter layer.",
        example: `// External client — raw SDK, no domain knowledge
import Stripe from "stripe";

const stripeClient = new Stripe(process.env.STRIPE_KEY);

// This gets wrapped by StripePaymentGateway (adapter)
// Use cases never see this directly`,
        relations: ["Wrapped by Gateways", "Configured at Composition Root"]
      }
    ]
  },
  {
    id: "di",
    title: "Dependency Injection",
    desc: "How dependencies are provided, not created",
    icon: "&#x1F489;",
    color: "#9b59b6",
    items: [
      {
        title: "Constructor Injection",
        layer: "di",
        tags: ["di", "injection-type", "recommended"],
        desc: "Dependencies are passed through the constructor. The MOST recommended form — makes dependencies explicit, enables testing, enforces immutability.",
        example: `// Constructor Injection — dependencies are explicit
class CreateOrderUseCase {
  // Dependencies declared in constructor
  constructor(
    private orderRepo: OrderRepository,
    private payment: PaymentGateway
  ) {}
  // Cannot be created without its dependencies
  // Easy to mock in tests
}

// Test with mock
const useCase = new CreateOrderUseCase(
  new MockOrderRepo(),
  new MockPaymentGateway()
);`,
        relations: ["Most common DI pattern", "Used everywhere in Clean Architecture"]
      },
      {
        title: "Interface / Protocol Injection",
        layer: "di",
        tags: ["di", "abstraction", "dependency-inversion"],
        desc: "Depend on abstractions (interfaces), not concretions (classes). This is WHY DI works with Clean Architecture — inner layers define interfaces, outer layers implement them.",
        example: `// WRONG — depends on concrete class
class OrderService {
  private repo = new PostgresUserRepository(); // tight coupling!
}

// RIGHT — depends on interface
class OrderService {
  constructor(private repo: UserRepository) {} // any impl works
}

// The interface is in the DOMAIN layer
// The implementation is in the FRAMEWORKS layer
// Dependencies point INWARD`,
        relations: ["Enables Dependency Inversion Principle", "Core mechanism of Clean Architecture"]
      },
      {
        title: "Composition Root",
        layer: "di",
        tags: ["di", "wiring", "entry-point"],
        desc: "The ONE place where all dependencies are wired together. Usually in main() or the app bootstrap. This is the only place that knows about ALL concrete classes.",
        example: `// Composition Root — wire everything at startup
function bootstrap() {
  // Frameworks layer
  const db = new Pool({ connectionString: DB_URL });
  const stripe = new Stripe(STRIPE_KEY);

  // Concrete implementations
  const userRepo = new PostgresUserRepository(db);
  const orderRepo = new PostgresOrderRepository(db);
  const paymentGW = new StripePaymentGateway(stripe);

  // Use Cases (receive interfaces)
  const createOrder = new CreateOrderUseCase(orderRepo, paymentGW);
  const getUser = new GetUserUseCase(userRepo);

  // Controllers (receive use cases)
  const orderCtrl = new OrderController(createOrder);
  const userCtrl = new UserController(getUser);

  // Framework wiring
  const app = express();
  app.post("/orders", (req, res) => orderCtrl.handlePost(req, res));

  return app;
}`,
        relations: ["Only place knowing all concretions", "Lives at app entry point"]
      },
      {
        title: "DI Container",
        layer: "di",
        tags: ["di", "container", "automation"],
        desc: "A framework that automates dependency resolution. Registers types and their implementations, then resolves the full dependency graph automatically. Optional — manual DI is fine for small apps.",
        example: `// DI Container (e.g., tsyringe, InversifyJS)
import { container } from "tsyringe";

// Register: interface → implementation
container.register<UserRepository>(
  "UserRepository",
  { useClass: PostgresUserRepository }
);
container.register<PaymentGateway>(
  "PaymentGateway",
  { useClass: StripePaymentGateway }
);

// Resolve: container builds the full tree
const useCase = container.resolve(CreateOrderUseCase);
// Automatically injects PostgresUserRepository
// and StripePaymentGateway`,
        relations: ["Automates Composition Root", "Optional — not required for DI"]
      },
      {
        title: "Property / Setter Injection",
        layer: "di",
        tags: ["di", "injection-type", "optional-deps"],
        desc: "Dependencies are set via properties after construction. Use only for OPTIONAL dependencies. Less safe than constructor injection since the object can exist in an incomplete state.",
        example: `// Property Injection — for optional dependencies
class Logger {
  // Optional: works without it, but enhanced with it
  formatter?: LogFormatter;

  log(message: string) {
    const formatted = this.formatter
      ? this.formatter.format(message)
      : message;
    console.log(formatted);
  }
}

const logger = new Logger();
logger.formatter = new JsonFormatter(); // optional`,
        relations: ["Used for optional dependencies", "Less common than Constructor Injection"]
      },
      {
        title: "Method Injection",
        layer: "di",
        tags: ["di", "injection-type", "per-call"],
        desc: "Dependencies are passed as method parameters. Use when the dependency varies per call or is transient (like a request context).",
        example: `// Method Injection — dependency varies per call
class OrderService {
  process(order: Order, logger: RequestLogger) {
    logger.info(\`Processing order \${order.id}\`);
    // logger is different for each HTTP request
    // (carries request-specific context)
  }
}`,
        relations: ["For per-call dependencies", "Common for request-scoped objects"]
      }
    ]
  },
  {
    id: "principles",
    title: "Key Principles",
    desc: "Rules that tie Clean Architecture and DI together",
    icon: "&#x1F4D0;",
    color: "#95a5a6",
    items: [
      {
        title: "Dependency Rule",
        layer: "principle",
        tags: ["principle", "core-rule", "dependency-inversion"],
        desc: "Source code dependencies can ONLY point INWARD. Nothing in an inner layer can know about an outer layer. This is THE fundamental rule of Clean Architecture.",
        example: `// VIOLATION — Entity knows about database
class User {
  save() {
    db.query("INSERT INTO users ..."); // Entity → Framework!
  }
}

// CORRECT — Entity is pure, Repository is injected
class User {
  constructor(public name: string) {}
}

interface UserRepository {  // Defined in domain
  save(user: User): Promise<void>;
}

// PostgresUserRepository (frameworks) implements
// UserRepository (domain) — dependency points INWARD`,
        relations: ["The #1 rule of Clean Architecture", "Enabled by DI"]
      },
      {
        title: "Dependency Inversion Principle (DIP)",
        layer: "principle",
        tags: ["principle", "SOLID", "dependency-inversion"],
        desc: "High-level modules should not depend on low-level modules. Both should depend on abstractions. Abstractions should not depend on details. This is HOW the Dependency Rule is enforced.",
        example: `// WITHOUT DIP:
// UseCase → PostgresRepo  (high depends on low)

// WITH DIP:
// UseCase → Repository (interface)  ← abstractions
// PostgresRepo → Repository (interface)
//
// Both depend on the interface.
// The interface is owned by the INNER layer.
// Inner layer defines what it needs;
// Outer layer provides it.`,
        relations: ["The 'D' in SOLID", "Mechanism behind Dependency Rule"]
      },
      {
        title: "Single Responsibility Principle",
        layer: "principle",
        tags: ["principle", "SOLID", "single-responsibility"],
        desc: "A class should have one, and only one, reason to change. Each Use Case handles one action. Each Repository handles one entity's persistence.",
        example: `// WRONG — one class does everything
class OrderManager {
  createOrder() { /* ... */ }
  processPayment() { /* ... */ }
  sendEmail() { /* ... */ }
  generatePDF() { /* ... */ }
}

// RIGHT — separated responsibilities
class CreateOrderUseCase { /* ... */ }
class ProcessPaymentUseCase { /* ... */ }
class SendOrderEmailUseCase { /* ... */ }
class GenerateInvoicePDFUseCase { /* ... */ }`,
        relations: ["Why Use Cases are separated", "The 'S' in SOLID"]
      },
      {
        title: "Interface Segregation",
        layer: "principle",
        tags: ["principle", "SOLID", "abstraction"],
        desc: "Clients should not depend on methods they don't use. Create specific interfaces rather than one fat interface. Each use case depends only on the repository methods it needs.",
        example: `// WRONG — fat interface
interface Repository {
  find(): Promise<Entity>;
  save(): Promise<void>;
  delete(): Promise<void>;
  bulkInsert(): Promise<void>;
  runMigration(): Promise<void>; // not needed by use cases!
}

// RIGHT — segregated
interface ReadableRepo { find(id: string): Promise<Entity> }
interface WritableRepo { save(e: Entity): Promise<void> }

// Use case depends only on what it needs
class GetUserUseCase {
  constructor(private repo: ReadableRepo) {}
}`,
        relations: ["The 'I' in SOLID", "Keeps dependencies minimal"]
      },
      {
        title: "Testability",
        layer: "principle",
        tags: ["principle", "testing", "dependency-inversion"],
        desc: "Clean Architecture + DI makes every layer testable in isolation. Entities: pure unit tests. Use Cases: mock repositories. Controllers: mock use cases.",
        example: `// Testing a Use Case — mock the repository
class MockOrderRepo implements OrderRepository {
  orders: Order[] = [];
  async save(order: Order) { this.orders.push(order); }
  async findById(id: string) {
    return this.orders.find(o => o.id === id) ?? null;
  }
}

test("CreateOrder saves order", async () => {
  const mockRepo = new MockOrderRepo();
  const mockPayment = new MockPaymentGateway();
  const useCase = new CreateOrderUseCase(mockRepo, mockPayment);

  await useCase.execute({ userId: "1", items: [...] });

  expect(mockRepo.orders).toHaveLength(1);
});
// No database, no HTTP, no framework — pure logic test`,
        relations: ["The payoff of DI + Clean Architecture", "Each layer testable independently"]
      }
    ]
  }
];

const QUIZ = [
  {
    q: "Where should a Repository INTERFACE be defined?",
    opts: ["Frameworks layer", "Domain/Entities layer", "Adapters layer", "Use Cases layer"],
    answer: 1,
    explain: "Repository interfaces belong in the Domain layer. This allows Use Cases to depend on the interface (inward dependency), while the concrete implementation lives in Frameworks (outer layer). This is the Dependency Inversion Principle in action."
  },
  {
    q: "What is the Composition Root?",
    opts: [
      "A base class all entities inherit from",
      "The single place where all dependencies are wired together",
      "The database connection pool",
      "The main entity in the domain"
    ],
    answer: 1,
    explain: "The Composition Root is the ONE location (usually main() or app bootstrap) where all concrete implementations are created and injected. It's the only code that knows about every concrete class."
  },
  {
    q: "Which direction must dependencies point in Clean Architecture?",
    opts: ["Outward (inner → outer)", "Inward (outer → inner)", "Both directions freely", "Only between adjacent layers"],
    answer: 1,
    explain: "The Dependency Rule states that source code dependencies can ONLY point inward. Outer layers depend on inner layers, never the reverse. Inner layers define interfaces; outer layers implement them."
  },
  {
    q: "What is the recommended form of Dependency Injection?",
    opts: ["Property Injection", "Service Locator", "Constructor Injection", "Global singleton"],
    answer: 2,
    explain: "Constructor Injection is recommended because it makes dependencies explicit, ensures the object can't exist without its dependencies, and makes testing straightforward. The dependency is required and immutable."
  },
  {
    q: "A Use Case should...",
    opts: [
      "Directly query the database",
      "Know which web framework is being used",
      "Orchestrate entities via repository interfaces",
      "Format data for the UI"
    ],
    answer: 2,
    explain: "Use Cases orchestrate domain entities and interact with the outside world through interfaces (repositories, gateways). They never know about databases, HTTP frameworks, or UI formatting — those are outer layer concerns."
  },
  {
    q: "What does a Controller do in Clean Architecture?",
    opts: [
      "Contains business logic",
      "Converts external input to use case input and calls the use case",
      "Directly accesses the database",
      "Defines domain entities"
    ],
    answer: 1,
    explain: "A Controller (in the Interface Adapters layer) translates external requests (HTTP, CLI, etc.) into Use Case input DTOs, invokes the Use Case, and translates the output back for the external world."
  },
  {
    q: "Why is Dependency Inversion important?",
    opts: [
      "It makes code run faster",
      "It lets inner layers define what they need, and outer layers provide it",
      "It reduces the number of files",
      "It eliminates the need for interfaces"
    ],
    answer: 1,
    explain: "DIP lets high-level modules (use cases) define interfaces for what they need, while low-level modules (databases, APIs) implement those interfaces. Both depend on abstractions. This keeps the core logic independent and testable."
  },
  {
    q: "Where does a StripePaymentGateway implementation belong?",
    opts: ["Entities layer", "Use Cases layer", "Interface Adapters layer", "Frameworks layer"],
    answer: 2,
    explain: "A StripePaymentGateway is an Interface Adapter — it translates between your domain's PaymentGateway interface and the external Stripe SDK. It adapts the external format to your internal format."
  },
  {
    q: "What is a DI Container?",
    opts: [
      "A special database for storing dependencies",
      "A framework that automates dependency resolution from registered types",
      "A design pattern that replaces interfaces",
      "The outermost layer of Clean Architecture"
    ],
    answer: 1,
    explain: "A DI Container automates the Composition Root by letting you register interface→implementation mappings, then resolving the full dependency graph automatically. It's optional — manual wiring works fine for small apps."
  },
  {
    q: "An Entity in Clean Architecture should...",
    opts: [
      "Know how to save itself to the database",
      "Contain only pure business rules with no external dependencies",
      "Be aware of the HTTP request context",
      "Depend on the Use Case layer"
    ],
    answer: 1,
    explain: "Entities contain only enterprise-wide business rules. They have NO dependencies on outer layers — no database, no framework, no HTTP. They are the most stable, least likely to change part of the system."
  }
];
